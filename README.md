# RouteFit

> 여러 방문 장소를 실시간 교통 정보에 맞춰 효율적인 차량 동선으로 연결하는 웹 앱

[RouteFit 바로가기](https://www.routefit.co.kr)

RouteFit은 장소·주소를 검색하거나 지도에서 직접 선택해 방문 목록을 만들고, NAVER Directions API의 교통 정보를 바탕으로 방문 순서를 계산합니다. 데스크톱에서는 좌·우 패널과 지도를 함께 사용하고, 모바일에서는 지도 위 하단 시트로 같은 기능을 사용할 수 있습니다.

## 주요 기능

- **장소 추가** — Kakao Local API로 장소를 검색하고, 검색이 실패하거나 결과가 없을 때는 NAVER 지오코딩 결과를 사용합니다. 지도에서 길게 눌러 주변 장소나 주소를 추가할 수도 있습니다.
- **방문 순서 설정** — 최대 15곳의 방문 장소를 드래그해 정렬하고, 반드시 지켜야 하는 경유지 순서는 고정할 수 있습니다. 각 장소의 머무는 시간도 반영합니다.
- **경로 최적화** — 빠른 길·균형·편한 길 중 주행 기준을 선택해 최적화합니다. 전체 거리, 예상 소요 시간, 통행료, 구간별 경로와 교통 상태를 제공합니다.
- **복귀 및 도착지** — 출발지로 복귀하거나, 마지막 방문 장소를 도착지로 지정할 수 있습니다.
- **현재 위치** — 버튼을 누를 때 한 번만 현재 위치를 가져와 방문 장소에 추가하거나 갱신합니다. 지속 위치 추적은 사용하지 않습니다.
- **장소 리스트** — Google 로그인 후 장소를 색상별 리스트로 저장하고, 저장 장소를 방문 동선에 추가·제거할 수 있습니다. 한 장소는 여러 리스트에 저장할 수 있습니다.
- **PWA** — 프로덕션 배포에서 설치 가능한 웹 앱으로 동작합니다. 네트워크가 끊기면 안내 화면과 재시도 기능을 제공합니다.

경로 계산은 방문 장소가 2곳 이상일 때 가능하며, 한 동선에는 최대 **15곳**을 추가할 수 있습니다.

## 사용 방법

1. 검색창에서 장소·주소를 찾거나 지도에서 위치를 선택해 방문 장소를 추가합니다.
2. 필요하면 카드를 드래그해 순서를 바꾸고, 자물쇠 메뉴에서 고정할 방문 순서를 지정합니다.
3. 복귀 여부, 각 장소의 머무는 시간, 주행 기준을 설정합니다.
4. **동선 최적화**를 누릅니다.
5. 계산 결과에서 방문 순서와 구간을 선택해 지도 경로, 거리, 예상 시간, 통행료를 확인합니다.

동선 변경 뒤 기존 결과는 바로 지워지지 않고 **오래된 결과**로 남습니다. 새 조건을 반영하려면 다시 계산하세요.

## 회원 기능

기본적인 검색, 지도, 방문 장소 편집, 경로 계산은 로그인 없이 사용할 수 있습니다. 비회원의 작업 공간은 현재 브라우저 세션에 보관됩니다.

Google 로그인 회원은 다음 기능을 추가로 이용합니다.

- 방문 장소, 복귀 설정, 고정 방문 순서를 서버에 자동 저장하고 다음 접속 때 복원
- 장소 리스트 생성·수정·삭제 및 저장 장소 관리
- 검색 결과나 방문 장소를 하나 이상의 장소 리스트에 저장

회원당 장소 리스트는 최대 **50개**, 리스트 하나에는 장소를 최대 **100곳**까지 저장할 수 있습니다.

## 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 프런트엔드 | Next.js App Router, React, TypeScript |
| 지도·경로 | NAVER Maps JavaScript API, NAVER Directions 5 API |
| 장소 검색 | Kakao Local API, NAVER Geocoding API(대체 결과) |
| 인증·데이터 | Better Auth, Google OAuth, Drizzle ORM, PostgreSQL |
| UI·검증 | Lucide React, React Toastify, Zod |
| 테스트·PWA | Vitest, next-pwa |

## 로컬 실행

### 요구 사항

- Node.js 및 npm
- PostgreSQL 데이터베이스(로그인·장소 리스트 기능 사용 시)
- NAVER Maps, Kakao Local, Google OAuth API 자격 증명

### 설치 및 시작

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

개발 서버는 기본적으로 [http://localhost:3000](http://localhost:3000)에서 실행됩니다. `npm run dev`는 Turbopack 개발 서버이며, PWA 서비스 워커는 개발 환경에서 비활성화됩니다.

### 환경 변수

`.env.example`을 `.env.local`로 복사한 뒤 값을 채웁니다. `.env.local`에는 민감한 값이 있으므로 Git에 커밋하지 않습니다.

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | NAVER Maps JavaScript API 클라이언트 ID |
| `NAVER_MAP_API_KEY_ID` | NAVER Maps 서버 API 키 ID |
| `NAVER_MAP_API_KEY_SECRET` | NAVER Maps 서버 API 키 Secret |
| `KAKAO_REST_API_KEY` | Kakao Local API REST API 키 |
| `ROUTE_CACHE_TTL_SECONDS` | 경로 비용 캐시 유지 시간(초, 기본 예시: `300`) |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `BETTER_AUTH_SECRET` | Better Auth 서명용 비밀 값 |
| `BETTER_AUTH_URL` | 현재 앱의 기본 URL |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 Secret |

Google OAuth 승인 리디렉션 URI는 아래를 등록합니다.

- 개발: `http://localhost:3000/api/auth/callback/google`
- 운영: `https://www.routefit.co.kr/api/auth/callback/google`

## 데이터베이스와 검증

스키마를 변경한 뒤에는 마이그레이션을 생성하고 적용합니다.

```powershell
npm run db:generate
npm run db:migrate
```

테스트, 타입 검사, 프로덕션 빌드는 다음과 같이 실행합니다.

```powershell
npm test
npx tsc --noEmit --incremental false
npm run build
npm run start
```

`npm run build`와 `npm run start`로 실행한 프로덕션 환경에서 PWA가 활성화됩니다. 설치·업데이트·오프라인 동작을 확인할 때는 이 조합을 사용하세요.

## 프로젝트 구조

```text
src/
├─ app/                         # 페이지와 API Route Handlers
│  ├─ api/                      # 검색, 지도, 인증, 장소 리스트, 경로 API
│  ├─ offline/                  # 오프라인 안내 페이지
│  └─ page.tsx                  # 화면 상태와 기능 조율
├─ components/
│  ├─ map/                      # NAVER 지도, 마커, 경로, 팝업
│  ├─ member/                   # 로그인과 장소 리스트 UI
│  ├─ pwa/                      # 설치, 업데이트, 오프라인 상태 UI
│  └─ route-planner/            # 검색, 방문 장소, 설정, 계산 결과 UI
├─ features/
│  ├─ place-search/             # 장소 검색 타입
│  ├─ member/                   # 회원·장소 리스트 타입
│  └─ route-optimization/       # 최적화 알고리즘, 비용 행렬, 경로 타입
├─ hooks/                       # 모바일 하단 시트 제어
└─ lib/                         # API 클라이언트, DB, 캐시, 유효성 검사

drizzle/                        # PostgreSQL 마이그레이션
public/icons/                   # PWA 아이콘
docs/                           # 개발 인수인계와 설계 메모
```

## 운영 시 참고

- 최적화는 방향성이 있는 이동 시간 행렬을 만들기 때문에 장소가 늘수록 NAVER Directions API 요청 수가 빠르게 증가합니다. 예를 들어 7곳이면 약 42회의 행렬 요청이 필요합니다.
- 경로 결과는 계산 당시의 교통 정보에 의존하며, 저장하지 않습니다. 최신 교통 정보를 반영하려면 다시 계산해야 합니다.
- `NEXT_PUBLIC_*` 환경 변수는 브라우저에 노출됩니다. 서버 API 키와 OAuth Secret은 절대 `NEXT_PUBLIC_` 접두사로 만들지 마세요.
- PWA 아이콘은 `public/icons`를 기준으로 하며, 아이콘 바이트를 교체할 때는 `public/site.webmanifest`와 `src/app/layout.tsx`의 캐시 버전도 함께 점검하세요.
