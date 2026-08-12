-- 상품 카탈로그는 로그인 전에도 둘러볼 수 있지만 구매와 개인 기록은 계속 인증 사용자에게만 허용합니다.

grant select on table public.rewards to anon;

drop policy if exists rewards_public_read_active on public.rewards;
create policy rewards_public_read_active
on public.rewards for select
to anon
using (is_active);
