-- 사용자가 자기 행에 접근하더라도 서버 관리 컬럼은 직접 바꿀 수 없도록 제한합니다.

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke update on public.user_missions from authenticated;
grant update (
  status,
  elapsed_minutes,
  consecutive_violations,
  started_at,
  completed_at
) on public.user_missions to authenticated;

drop policy user_missions_update_own on public.user_missions;
create policy user_missions_update_own
on public.user_missions for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and points_awarded = false
);

revoke update on public.aircon_status from authenticated;
grant update (
  power_on,
  mode,
  set_temperature,
  fan_mode,
  usage_minutes,
  filter_life,
  sensor_status,
  status_tone
) on public.aircon_status to authenticated;
