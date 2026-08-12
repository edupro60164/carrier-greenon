# Carrier GreenON

Carrier GreenON은 캐리어 에어컨 사용자를 위한 ESG 친환경 냉방 미션·GREEN POINT·리워드 웹앱입니다. 실제 에어컨 API 대신 가상 IoT 상태를 사용하며, 사용자 데이터는 Supabase Auth·Postgres·RLS로 분리합니다.

## 주요 기능

- 서울 현재 날씨와 날씨 조건별 GREEN MISSION
- 가상 Carrier 에어컨 정상·절전·필터 점검·센서 오류·전원 꺼짐 시뮬레이션
- 미션 성공 시 서버 검증을 거친 GREEN POINT 지급
- GREEN WALLET, 포인트 적립·사용 기록, GREEN LEVEL과 REPORT
- GREEN REWARD SHOP 상품 구매와 구매내역
- Supabase 회원가입·로그인 및 사용자별 RLS 데이터 격리

## 기술 구성

- Frontend: HTML, CSS, Vanilla JavaScript
- Runtime: Node.js 22 이상 내장 HTTP 서버
- Database/Auth: Supabase
- Weather: Open-Meteo Forecast API
- Deployment: Render Web Service

## 로컬 실행

1. `.env.example`을 복사해 `.env`를 만듭니다.
2. `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`에 본인 프로젝트의 공개 클라이언트 값을 입력합니다.
3. 아래 명령을 실행합니다.

```bash
npm ci
npm run build
npm start
```

기본 주소는 `http://localhost:10000`이며 상태 점검 주소는 `http://localhost:10000/health`입니다.

## 환경변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `SUPABASE_URL` | 예 | Supabase 프로젝트 HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | 예 | 브라우저 사용이 허용된 publishable key |
| `WEATHER_API_URL` | 아니요 | 기본값은 Open-Meteo Forecast API |
| `WEATHER_LOCATION_NAME` | 아니요 | 기본값 `서울` |
| `WEATHER_LATITUDE` | 아니요 | 기본값 `37.5665` |
| `WEATHER_LONGITUDE` | 아니요 | 기본값 `126.9780` |
| `WEATHER_TIMEZONE` | 아니요 | 기본값 `Asia/Seoul` |
| `PORT` | 아니요 | Render가 자동 설정하며 로컬 기본값은 `10000` |

`service_role`, secret key, 데이터베이스 비밀번호는 브라우저 설정이나 저장소에 넣지 않습니다. Publishable key는 브라우저 공개용이지만 저장소별 설정 분리를 위해 Render 환경변수에서 주입합니다.

## Supabase 마이그레이션

SQL 파일은 [supabase/migrations](./supabase/migrations)에 적용 순서대로 정리되어 있습니다. 운영 데이터 변경은 Supabase 마이그레이션을 통해 적용하고, 모든 공개 테이블에 RLS와 최소 권한을 유지합니다.

## Render 배포 준비

저장소 루트의 `render.yaml`은 다음 구성을 선언합니다.

- Node Web Service, Singapore 리전
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health Check: `/health`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`는 Dashboard 입력값 사용

Render 서비스 생성 후 환경변수를 등록하고 첫 배포를 실행합니다. 서버는 Render 요구사항에 맞춰 `0.0.0.0`과 `PORT`에 바인딩합니다.
운영 환경에서 필수 Supabase 값이 없거나 publishable key 형식이 아니면 `/health`가 `503`을 반환해 잘못된 배포를 차단합니다.

## 보안 메모

- 런타임 서버는 앱에 필요한 네 파일과 `config.js`, `/health`만 제공합니다.
- Supabase SQL, `.env`, 프로젝트 문서는 웹 경로로 제공하지 않습니다.
- 보상 지급과 상품 구매는 데이터베이스 트리거에서 검증합니다.
- Content Security Policy, 클릭재킹 방지, MIME 스니핑 방지 헤더를 적용합니다.
