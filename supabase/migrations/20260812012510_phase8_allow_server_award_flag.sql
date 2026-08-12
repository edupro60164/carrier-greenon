-- points_awarded는 사용자에게 UPDATE 권한이 없고 DB 트리거만 변경합니다.
-- 최종 행 RLS는 소유권을 검사하되 서버가 기록한 성공 플래그는 허용합니다.

drop policy user_missions_update_own on public.user_missions;

create policy user_missions_update_own
on public.user_missions for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);
