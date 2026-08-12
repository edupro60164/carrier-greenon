# Carrier GreenON Supabase

PHASE 7~8에서 사용하는 Supabase 데이터베이스와 실제 데이터 흐름 정의입니다.

## 적용된 데이터 구조

- `profiles`: Auth 사용자 프로필과 GREEN LEVEL
- `missions`: GREEN MISSION 기준 데이터
- `user_missions`: 사용자별 미션 참여 기록
- `point_transactions`: 사용자별 GREEN POINT 적립·사용 기록
- `green_levels`: GREEN LEVEL 기준 데이터
- `rewards`: GREEN REWARD SHOP 상품
- `reward_orders`: 사용자별 상품 구매내역
- `aircon_status`: 사용자별 가상 에어컨 상태

## PHASE 8 실제 데이터 흐름

- 회원가입 시 프로필, 시작 포인트 1,000P, 기본 가상 에어컨 상태를 자동 생성합니다.
- 미션 진행 상태는 `user_missions`에 저장하며, 성공 보상은 데이터베이스 트리거가 한 번만 지급합니다.
- 상품 구매는 재고 확인, 포인트 잔액 확인, 재고 차감, 주문 생성, 포인트 사용 기록을 한 트랜잭션에서 처리합니다.
- 포인트 잔액은 `point_transactions` 적립·사용 기록의 합계로 계산합니다.
- 새로고침하거나 다른 기기에서 로그인해도 미션, 포인트, 구매내역, 가상 에어컨 상태를 다시 불러옵니다.
- PHASE 6~7에서 사용한 임시 `localStorage` 지갑 데이터는 앱 시작 시 제거합니다.
- PHASE 9부터 `missions.weather_condition`으로 무더운 날, 습한 날, 선선한 날 미션을 구분합니다.

## 보안 원칙

- 모든 `public` 테이블에 RLS가 활성화되어 있습니다.
- 인증된 사용자는 자신의 프로필, 미션 기록, 포인트 기록, 주문, 에어컨 상태만 조회할 수 있습니다.
- 클라이언트가 미션 보상 포인트나 주문 금액을 임의로 지정할 수 없도록 데이터베이스 트리거가 검증합니다.
- 보상 지급·구매 처리 함수는 `private` 스키마에 두고 직접 실행 권한을 제거했습니다.
- 프런트엔드는 publishable key만 사용하며 `service_role` 또는 secret key를 사용하지 않습니다.

## 마이그레이션

파일명 순서대로 적용합니다.

1. `20260812010526_phase7_initial_schema.sql`
2. `20260812011114_phase7_harden_user_writes.sql`
3. `20260812012322_phase8_secure_data_flows.sql`
4. `20260812012510_phase8_allow_server_award_flag.sql`
5. `20260812015307_phase9_weather_missions.sql`

## Auth 이메일

Supabase 기본 이메일 서비스는 테스트용 발송 제한이 있습니다. 운영 배포 전 Auth SMTP 설정에서 전용 SMTP 공급자를 연결해야 합니다.
