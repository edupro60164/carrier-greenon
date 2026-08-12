-- Carrier GreenON PHASE 9: 날씨 조건별 GREEN MISSION 기준 데이터

alter table public.missions
  add column if not exists weather_condition text;

update public.missions
set weather_condition = 'hot'
where weather_condition is null;

alter table public.missions
  alter column weather_condition set default 'hot',
  alter column weather_condition set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'missions_weather_condition_check'
      and conrelid = 'public.missions'::regclass
  ) then
    alter table public.missions
      add constraint missions_weather_condition_check
      check (weather_condition in ('hot', 'humid', 'mild'));
  end if;
end
$$;

insert into public.missions (
  code,
  title,
  description,
  reward_points,
  target_minutes,
  target_temperature,
  weather_condition,
  is_active
)
values
  (
    'daily_eco_cooling_26',
    '무더운 날 26°C 친환경 냉방',
    '외부 기온이 높은 날에는 26°C 냉방을 90분 유지해 효율과 쾌적함을 함께 지켜요.',
    100,
    90,
    26,
    'hot',
    true
  ),
  (
    'daily_humid_cooling_26',
    '습한 날 26°C 쾌적 냉방',
    '습도가 높은 날에는 26°C 냉방을 60분 유지하고 불필요한 과냉방을 줄여요.',
    80,
    60,
    26,
    'humid',
    true
  ),
  (
    'daily_mild_cooling_27',
    '선선한 날 27°C 절전 냉방',
    '비교적 선선한 날에는 27°C로 60분 냉방하며 에너지를 더 아껴요.',
    80,
    60,
    27,
    'mild',
    true
  )
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  reward_points = excluded.reward_points,
  target_minutes = excluded.target_minutes,
  target_temperature = excluded.target_temperature,
  weather_condition = excluded.weather_condition,
  is_active = excluded.is_active,
  updated_at = now();

comment on column public.missions.weather_condition is
  'PHASE 9 날씨 분류: hot, humid, mild';
