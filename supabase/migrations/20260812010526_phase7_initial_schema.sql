-- Carrier GreenON PHASE 7: Supabase 스키마, 기준 데이터, RLS 정책
-- 브라우저에는 publishable key만 사용하며 service_role/secret key는 사용하지 않습니다.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.green_levels (
  id smallint primary key,
  code text not null unique,
  name text not null,
  korean_name text not null,
  minimum_points integer not null unique check (minimum_points >= 0),
  icon text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  green_level smallint not null default 1 references public.green_levels(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.missions (
  id bigint generated always as identity primary key,
  code text not null unique,
  title text not null,
  description text not null,
  reward_points integer not null check (reward_points > 0),
  target_minutes smallint not null check (target_minutes > 0),
  target_temperature numeric(3,1) not null check (target_temperature between 16 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_missions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id bigint not null references public.missions(id) on delete restrict,
  mission_date date not null default current_date,
  status text not null default 'available'
    check (status in ('available', 'active', 'warning', 'success', 'failed')),
  elapsed_minutes smallint not null default 0 check (elapsed_minutes between 0 and 1440),
  consecutive_violations smallint not null default 0 check (consecutive_violations between 0 and 10),
  points_awarded boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id, mission_date)
);

create table public.point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('earn', 'use')),
  amount integer not null check (
    (transaction_type = 'earn' and amount > 0)
    or (transaction_type = 'use' and amount < 0)
  ),
  source_type text not null check (source_type in ('welcome', 'mission', 'reward', 'admin')),
  source_id text,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.rewards (
  id bigint generated always as identity primary key,
  code text not null unique,
  category text not null check (category in ('FOOD', 'LIFE', 'CARRIER')),
  name text not null,
  description text not null,
  detail text not null,
  price_points integer not null check (price_points > 0),
  emoji text not null,
  tone text not null check (tone in ('sky', 'orange', 'green', 'blue', 'mint', 'purple')),
  is_active boolean not null default true,
  stock integer check (stock is null or stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reward_orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id bigint not null references public.rewards(id) on delete restrict,
  product_name text not null,
  points_spent integer not null check (points_spent > 0),
  status text not null default 'ordered' check (status in ('ordered', 'cancelled')),
  ordered_at timestamptz not null default now()
);

create table public.aircon_status (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  power_on boolean not null default true,
  mode text not null default 'cool' check (mode in ('cool', 'dry', 'fan', 'standby', 'error')),
  set_temperature numeric(3,1) check (set_temperature between 16 and 30),
  fan_mode text not null default 'auto' check (fan_mode in ('auto', 'low', 'medium', 'high', 'stopped')),
  usage_minutes integer not null default 0 check (usage_minutes >= 0),
  filter_life smallint not null default 100 check (filter_life between 0 and 100),
  sensor_status text not null default 'normal' check (sensor_status in ('normal', 'error')),
  status_tone text not null default 'normal' check (status_tone in ('normal', 'danger', 'off')),
  updated_at timestamptz not null default now()
);

-- 외래키와 사용자 소유권 정책에 쓰는 컬럼을 인덱싱합니다.
create index profiles_green_level_idx on public.profiles (green_level);
create index user_missions_user_id_idx on public.user_missions (user_id);
create index user_missions_mission_id_idx on public.user_missions (mission_id);
create index point_transactions_user_created_idx on public.point_transactions (user_id, created_at desc);
create index reward_orders_user_ordered_idx on public.reward_orders (user_id, ordered_at desc);
create index reward_orders_reward_id_idx on public.reward_orders (reward_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auth 사용자가 생성되면 공개 스키마에는 최소 프로필 정보만 만듭니다.
-- display_name은 화면 표시용일 뿐 권한 판정에는 사용하지 않습니다.
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
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger missions_set_updated_at
before update on public.missions
for each row execute function private.set_updated_at();

create trigger user_missions_set_updated_at
before update on public.user_missions
for each row execute function private.set_updated_at();

create trigger rewards_set_updated_at
before update on public.rewards
for each row execute function private.set_updated_at();

create trigger aircon_status_set_updated_at
before update on public.aircon_status
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.green_levels enable row level security;
alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_orders enable row level security;
alter table public.aircon_status enable row level security;

create policy green_levels_authenticated_read
on public.green_levels for select
to authenticated
using (true);

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy missions_authenticated_read_active
on public.missions for select
to authenticated
using (is_active);

create policy user_missions_select_own
on public.user_missions for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy user_missions_insert_own
on public.user_missions for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and points_awarded = false
);

create policy user_missions_update_own
on public.user_missions for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy point_transactions_select_own
on public.point_transactions for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy rewards_authenticated_read_active
on public.rewards for select
to authenticated
using (is_active);

create policy reward_orders_select_own
on public.reward_orders for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy aircon_status_select_own
on public.aircon_status for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy aircon_status_insert_own
on public.aircon_status for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy aircon_status_update_own
on public.aircon_status for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- 최소 권한만 공개 API 역할에 부여합니다.
revoke all on public.green_levels, public.profiles, public.missions, public.user_missions,
  public.point_transactions, public.rewards, public.reward_orders, public.aircon_status
from anon, authenticated;

grant select on public.green_levels, public.missions, public.point_transactions,
  public.rewards, public.reward_orders
to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_missions, public.aircon_status to authenticated;
grant usage, select on sequence public.user_missions_id_seq, public.aircon_status_id_seq to authenticated;

insert into public.green_levels (id, code, name, korean_name, minimum_points, icon, description)
values
  (1, 'green_seed', 'GREEN SEED', '초록 씨앗', 0, '🌱', '첫 친환경 냉방 습관을 시작했어요.'),
  (2, 'green_sprout', 'GREEN SPROUT', '초록 새싹', 500, '🌿', '꾸준한 실천으로 초록 습관이 자라고 있어요.'),
  (3, 'green_leaf', 'GREEN LEAF', '초록 잎새', 1500, '🍃', '생활 속 친환경 냉방을 능숙하게 실천하고 있어요.'),
  (4, 'green_tree', 'GREEN TREE', '초록 나무', 3000, '🌳', '지속 가능한 냉방 습관을 이끄는 GreenON 마스터예요.')
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  korean_name = excluded.korean_name,
  minimum_points = excluded.minimum_points,
  icon = excluded.icon,
  description = excluded.description;

insert into public.missions (
  code, title, description, reward_points, target_minutes, target_temperature, is_active
)
values (
  'daily_eco_cooling_26',
  '26°C 친환경 냉방 미션',
  '에어컨을 26°C로 설정하고 90분 동안 친환경 냉방을 유지해요.',
  100,
  90,
  26,
  true
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  reward_points = excluded.reward_points,
  target_minutes = excluded.target_minutes,
  target_temperature = excluded.target_temperature,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.rewards (code, category, name, description, detail, price_points, emoji, tone)
values
  ('food_iced_americano', 'FOOD', '아이스 아메리카노', '시원한 휴식을 위한 모바일 음료 쿠폰', '미션을 마친 뒤 즐기는 시원한 한 잔이에요. 실제 쿠폰은 발송되지 않는 시뮬레이션 상품입니다.', 500, '☕', 'sky'),
  ('food_vegan_cookie', 'FOOD', '비건 오트 쿠키', '식물성 재료로 만든 든든한 간식', '환경을 생각한 식물성 재료의 오트 쿠키예요. 구매 흐름을 체험하기 위한 가상 상품입니다.', 700, '🍪', 'orange'),
  ('life_eco_bag', 'LIFE', '폴더블 에코백', '작게 접어 매일 들고 다니는 장바구니', '일회용 봉투 사용을 줄이는 가벼운 폴더블 에코백이에요. 밝은 GreenON 컬러로 구성했어요.', 900, '🛍️', 'green'),
  ('life_blue_tumbler', 'LIFE', 'GreenON 블루 텀블러', '시원함을 오래 지켜 주는 데일리 텀블러', '일회용 컵을 줄이고 시원한 음료를 오래 즐기는 GreenON 전용 텀블러 시뮬레이션 상품입니다.', 1200, '🥤', 'blue'),
  ('carrier_filter_care', 'CARRIER', 'Carrier 필터 케어 쿠폰', '깨끗한 냉방을 위한 필터 점검 리워드', '가상 Carrier 에어컨의 필터 케어 서비스를 체험하는 쿠폰이에요. 실제 방문 서비스는 제공되지 않습니다.', 1800, '🧼', 'mint'),
  ('carrier_air_circulator', 'CARRIER', 'Carrier 미니 서큘레이터', '냉기를 빠르게 순환하는 귀여운 미니 팬', '에어컨과 함께 사용해 냉방 효율을 돕는 가상 미니 서큘레이터 상품입니다.', 2800, '🌀', 'purple')
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  detail = excluded.detail,
  price_points = excluded.price_points,
  emoji = excluded.emoji,
  tone = excluded.tone,
  is_active = true,
  updated_at = now();
