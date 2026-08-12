-- Carrier GreenON PHASE 8: 실제 DB 데이터 흐름과 원자적 보상·구매 처리

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'point_transactions_user_source_unique'
      and conrelid = 'public.point_transactions'::regclass
  ) then
    alter table public.point_transactions
      add constraint point_transactions_user_source_unique
      unique (user_id, source_type, source_id);
  end if;
end
$$;

-- 사용자가 미션 시간을 한 번에 건너뛰거나 서버 관리값을 바꾸지 못하게 전환 규칙을 검사합니다.
create or replace function private.enforce_user_mission_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  mission_target smallint;
begin
  if current_user_id is null or new.user_id <> current_user_id then
    raise exception using errcode = '42501', message = 'mission_user_mismatch';
  end if;

  select target_minutes into mission_target
  from public.missions
  where id = new.mission_id and is_active = true;

  if mission_target is null then
    raise exception using errcode = 'P0001', message = 'mission_not_available';
  end if;

  if tg_op = 'INSERT' then
    new.status := 'active';
    new.elapsed_minutes := 0;
    new.consecutive_violations := 0;
    new.points_awarded := false;
    new.started_at := now();
    new.completed_at := null;
    return new;
  end if;

  new.user_id := old.user_id;
  new.mission_id := old.mission_id;
  new.mission_date := old.mission_date;
  new.points_awarded := old.points_awarded;

  if old.status = 'success' then
    raise exception using errcode = 'P0001', message = 'mission_already_completed';
  end if;

  if new.status = 'active'
    and new.elapsed_minutes = 0
    and new.consecutive_violations = 0 then
    new.started_at := now();
    new.completed_at := null;
    return new;
  end if;

  if new.elapsed_minutes = old.elapsed_minutes + 30
    and new.consecutive_violations = 0 then
    if new.elapsed_minutes >= mission_target then
      new.elapsed_minutes := mission_target;
      new.status := 'success';
      new.points_awarded := true;
      new.completed_at := now();
    else
      new.status := 'active';
      new.completed_at := null;
    end if;
    return new;
  end if;

  if new.elapsed_minutes = old.elapsed_minutes
    and new.consecutive_violations = old.consecutive_violations + 1 then
    if new.consecutive_violations >= 2 then
      new.status := 'failed';
      new.completed_at := now();
    else
      new.status := 'warning';
      new.completed_at := null;
    end if;
    return new;
  end if;

  raise exception using errcode = 'P0001', message = 'invalid_mission_transition';
end;
$$;

-- 성공 전환과 포인트 적립을 같은 DB 트랜잭션에서 처리합니다.
create or replace function private.award_completed_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  mission_reward integer;
  mission_title text;
begin
  if new.status <> 'success' or old.status = 'success' then
    return new;
  end if;

  if current_user_id is null or current_user_id <> new.user_id then
    raise exception using errcode = '42501', message = 'mission_reward_user_mismatch';
  end if;

  select reward_points, title into mission_reward, mission_title
  from public.missions
  where id = new.mission_id and is_active = true;

  if mission_reward is null then
    raise exception using errcode = 'P0001', message = 'mission_reward_not_found';
  end if;

  insert into public.point_transactions (
    user_id, transaction_type, amount, source_type, source_id, title, description, created_at
  ) values (
    new.user_id, 'earn', mission_reward, 'mission', new.id::text,
    mission_title, 'GREEN MISSION 성공 보상', now()
  )
  on conflict (user_id, source_type, source_id) do nothing;

  update public.profiles
  set green_level = coalesce(
    (
      select level_data.id
      from public.green_levels level_data
      where level_data.minimum_points <= (
        select coalesce(sum(transaction_data.amount), 0)
        from public.point_transactions transaction_data
        where transaction_data.user_id = new.user_id and transaction_data.amount > 0
      )
      order by level_data.minimum_points desc
      limit 1
    ),
    1
  )
  where id = new.user_id;

  return new;
end;
$$;

-- 프로필 행 잠금 후 잔액 확인, 주문 보정, 포인트 차감을 원자적으로 수행합니다.
create or replace function private.secure_reward_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_reward public.rewards%rowtype;
  current_balance integer;
begin
  if current_user_id is null or new.user_id <> current_user_id then
    raise exception using errcode = '42501', message = 'reward_order_user_mismatch';
  end if;

  perform 1 from public.profiles where id = current_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  select * into selected_reward
  from public.rewards
  where id = new.reward_id and is_active = true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'reward_not_available';
  end if;

  if selected_reward.stock is not null and selected_reward.stock <= 0 then
    raise exception using errcode = 'P0001', message = 'reward_out_of_stock';
  end if;

  select coalesce(sum(amount), 0) into current_balance
  from public.point_transactions
  where user_id = current_user_id;

  if current_balance < selected_reward.price_points then
    raise exception using errcode = 'P0001', message = 'insufficient_points';
  end if;

  new.product_name := selected_reward.name;
  new.points_spent := selected_reward.price_points;
  new.status := 'ordered';
  new.ordered_at := now();

  if selected_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = selected_reward.id;
  end if;

  insert into public.point_transactions (
    user_id, transaction_type, amount, source_type, source_id, title, description, created_at
  ) values (
    current_user_id, 'use', -selected_reward.price_points, 'reward', new.id::text,
    selected_reward.name || ' 구매', 'GREEN REWARD SHOP 포인트 사용', now()
  );

  return new;
end;
$$;

revoke execute on function private.enforce_user_mission_progress() from public, anon, authenticated;
revoke execute on function private.award_completed_mission() from public, anon, authenticated;
revoke execute on function private.secure_reward_order() from public, anon, authenticated;

drop trigger if exists user_missions_validate_progress on public.user_missions;
create trigger user_missions_validate_progress
before insert or update on public.user_missions
for each row execute function private.enforce_user_mission_progress();

drop trigger if exists user_missions_award_points on public.user_missions;
create trigger user_missions_award_points
after update on public.user_missions
for each row execute function private.award_completed_mission();

drop trigger if exists reward_orders_secure_purchase on public.reward_orders;
create trigger reward_orders_secure_purchase
before insert on public.reward_orders
for each row execute function private.secure_reward_order();

drop policy if exists reward_orders_insert_own on public.reward_orders;
create policy reward_orders_insert_own
on public.reward_orders for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke insert on public.user_missions from authenticated;
grant insert (user_id, mission_id) on public.user_missions to authenticated;
grant insert (user_id, reward_id) on public.reward_orders to authenticated;
grant usage, select on sequence public.reward_orders_id_seq to authenticated;

-- 신규 사용자는 프로필, 시작 포인트, 가상 에어컨 상태를 함께 받습니다.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'GreenON 사용자'
      ),
      20
    )
  )
  on conflict (id) do nothing;

  insert into public.point_transactions (
    user_id, transaction_type, amount, source_type, source_id, title, description, created_at
  ) values (
    new.id, 'earn', 1000, 'welcome', 'welcome',
    'GreenON 시작 포인트', '친환경 냉방 여정 시작 보상', now()
  )
  on conflict (user_id, source_type, source_id) do nothing;

  update public.profiles
  set green_level = coalesce(
    (
      select level_data.id from public.green_levels level_data
      where level_data.minimum_points <= (
        select coalesce(sum(transaction_data.amount), 0)
        from public.point_transactions transaction_data
        where transaction_data.user_id = new.id and transaction_data.amount > 0
      )
      order by level_data.minimum_points desc limit 1
    ),
    1
  )
  where id = new.id;

  insert into public.aircon_status (
    user_id, power_on, mode, set_temperature, fan_mode,
    usage_minutes, filter_life, sensor_status, status_tone
  ) values (
    new.id, true, 'cool', 26, 'auto', 150, 82, 'normal', 'normal'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- 마이그레이션 전에 존재한 프로필도 동일한 초기 상태를 갖도록 보완합니다.
insert into public.point_transactions (
  user_id, transaction_type, amount, source_type, source_id, title, description, created_at
)
select
  profile_data.id, 'earn', 1000, 'welcome', 'welcome',
  'GreenON 시작 포인트', '친환경 냉방 여정 시작 보상', now()
from public.profiles profile_data
on conflict (user_id, source_type, source_id) do nothing;

insert into public.aircon_status (
  user_id, power_on, mode, set_temperature, fan_mode,
  usage_minutes, filter_life, sensor_status, status_tone
)
select
  profile_data.id, true, 'cool', 26, 'auto', 150, 82, 'normal', 'normal'
from public.profiles profile_data
on conflict (user_id) do nothing;

update public.profiles profile_data
set green_level = coalesce(
  (
    select level_data.id from public.green_levels level_data
    where level_data.minimum_points <= (
      select coalesce(sum(transaction_data.amount), 0)
      from public.point_transactions transaction_data
      where transaction_data.user_id = profile_data.id and transaction_data.amount > 0
    )
    order by level_data.minimum_points desc limit 1
  ),
  1
);
