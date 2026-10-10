# RouteFit

> 여러 방문 장소의 추천 방문 순서와 차량 이동 동선을 계산하는 웹 서비스

[RouteFit 바로가기](https://www.routefit.co.kr)

**현재 버전: v1.1.0 (2026.10.10)**

RouteFit은 장소·주소 검색 또는 지도 선택으로 방문 목록을 만들고, 빠른 방문 순서 추천과 NAVER Directions 5의 실제 주행 구간 정보를 결합해 동선을 보여 줍니다. 데스크톱·태블릿에서는 지도와 작업 패널을 함께, 모바일에서는 지도 위 하단 시트 형태로 이용할 수 있습니다.

## 업데이트 내역

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v1.1.0 | 2026.10.10 | 관리자 콘솔 추가 — NAVER Directions API 호출량, 회원·비회원별 사용량, 활성 공유 링크를 최근 7일·한 달·1년 범위로 조회할 수 있습니다. |
| v1.0.0 | 2026.08.07 | RouteFit 서비스 시작 |

## 주요 기능

- **장소 검색·추가** — Kakao Local API를 우선 사용하고, 검색 실패 또는 결과 없음 시 NAVER Geocoding으로 보완합니다. 지도에서 길게 눌러 주변 장소·주소를 추가할 수도 있습니다.
- **방문 장소 관리** — 최대 15곳의 방문 장소를 추가하고, 드래그 정렬, 출발지 복귀, 마지막 장소 도착지 지정, 머무는 시간 설정, 방문 순서 고정을 지원합니다.
- **경로 계산** — Haversine 기반 탐욕 탐색과 2-opt 개선으로 방문 순서를 빠르게 구성한 뒤, 인접한 최종 주행 구간만 NAVER Directions 5로 조회합니다. 전체 거리·예상 시간·통행료·구간별 교통 상태를 제공합니다.
- **현재 위치** — 사용자가 버튼을 누를 때만 현재 위치를 가져와 방문 장소에 반영합니다. 지속적인 위치 추적은 하지 않습니다.
- **회원 작업 공간** — Google 로그인 후 방문 장소, 복귀 설정, 고정 방문 순서를 서버에 저장하고 다음 접속 시 복원합니다.
- **장소 리스트** — 색상별 장소 리스트를 만들고, 하나의 장소를 여러 리스트에 저장하거나 동선에 바로 추가할 수 있습니다.
- **동선 공유** — 로그인 회원은 계산 완료한 동선의 공유 링크를 만들 수 있습니다. 생성된 링크는 로그인 없이 열 수 있으며, 30일 뒤 만료됩니다. 공유 링크 생성은 사용자별 시간당 10회로 제한합니다.
- **PWA·오프라인 안내** — 프로덕션 환경에서 설치 가능한 웹 앱으로 동작하며, 네트워크를 사용할 수 없을 때 오프라인 안내 화면을 제공합니다.
- **관리자 콘솔** — 허용된 관리자 계정만 API 호출량, 캐시 적중률, 호출 실패, 회원별 사용량, 활성 공유 링크를 확인할 수 있습니다.

## 사용 방법

1. 검색창 또는 지도에서 방문할 장소를 추가합니다.
2. 필요하면 장소 순서를 드래그해 조정하고, 자물쇠 메뉴에서 반드시 지킬 순서를 고정합니다.
3. 복귀 여부와 각 장소의 머무는 시간을 설정합니다.
4. **경로 최적화 계산**을 누릅니다.
5. 계산 결과에서 방문 순서·구간 상세를 확인하고, 각 구간을 선택해 지도에서 위치를 확인합니다.
6. 로그인 회원은 **내 동선 공유하기**로 공유 링크를 생성할 수 있습니다.

동선 조건을 변경해도 기존 결과는 바로 삭제되지 않고 **오래된 결과**로 남습니다. 변경 사항을 반영하려면 다시 계산해야 합니다.

## 경로 계산 방식

RouteFit은 많은 장소의 모든 쌍에 대해 도로 경로를 미리 조회하는 방식 대신 다음 절차를 사용합니다.

1. Haversine 거리로 가까운 후보를 선택해 초기 방문 순서를 만듭니다.
2. 2-opt로 두 구간의 연결을 교환하며 초기 순서를 개선합니다.
3. 확정된 인접 구간만 NAVER Directions 5로 조회해 실제 도로 거리, 시간, 통행료, 교통 상태를 표시합니다.

이 방식은 최대 15개 장소 기준으로 API 호출량과 대기 시간을 줄이는 실용적인 추천 순서를 제공합니다. 다만 모든 도로 비용을 대상으로 한 전역 최적해나 미래 교통 상황을 보장하지는 않습니다.

## 회원 기능과 권한

비회원도 장소 검색, 지도 선택, 방문 장소 편집, 경로 계산을 이용할 수 있습니다. 비회원 작업 공간은 현재 브라우저 세션에만 보관됩니다.

Google 로그인 회원은 작업 공간 복원, 장소 리스트 관리, 장소 저장, 공유 링크 생성을 이용할 수 있습니다. 회원당 장소 리스트는 최대 **50개**, 리스트 하나에는 최대 **100곳**을 저장할 수 있습니다.

관리자 콘솔은 `ADMIN_EMAILS`에 등록된 이메일이면서 이메일 인증이 완료된 계정만 접근할 수 있습니다. 클라이언트 메뉴 노출과 별개로 `/admin` 페이지에서도 서버 측 권한 검사를 수행합니다.

## 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 프런트엔드 | Next.js App Router, React, TypeScript |
| 지도·경로 | NAVER Maps JavaScript API, NAVER Directions 5 API |
| 장소 검색 | Kakao Local API, NAVER Geocoding API |
| 인증·데이터 | Better Auth, Google OAuth, Drizzle ORM, PostgreSQL |
| 캐시·제한 | Redis(ioredis), 공유 링크 생성 요청 제한 |
| UI·검증 | Lucide React, React Toastify, Zod |
| 분석·PWA | Google Tag Manager, next-pwa, Workbox |
| 테스트 | Vitest |

## 프로젝트 구조

```text
src/
├─ app/
│  ├─ admin/                    # 관리자 콘솔
│  ├─ api/                      # 검색, 인증, 회원, 경로, 공유 링크 API
│  ├─ share/[shareId]/           # 공개 공유 동선 페이지
│  └─ offline/                  # 오프라인 안내 페이지
├─ components/
│  ├─ map/                      # NAVER 지도, 마커, 경로, 지도 제어
│  ├─ member/                   # 로그인, 프로필, 장소 리스트 UI
│  ├─ pwa/                      # 설치, 업데이트, 오프라인 상태 UI
│  ├─ route-planner/            # 검색, 방문 장소, 계산 결과 UI
│  └─ shared-routes/            # 공유 동선 화면
├─ features/                    # 회원, 검색, 경로, 공유 동선 타입·로직
├─ hooks/                       # 작업 공간과 모바일 시트 상태
├─ lib/
│  ├─ admin/                    # 관리자 권한과 사용량 집계
│  ├─ cache/                    # Redis 경로 캐시와 요청 제한
│  ├─ shared-routes/            # 공유 링크 생성·만료 처리
│  └─ db/                       # Drizzle 스키마와 DB 연결
└─ scripts/                     # 만료 공유 링크 정리 스크립트

drizzle/                        # PostgreSQL 마이그레이션
public/icons/                   # PWA 아이콘
worker/                         # PWA 커스텀 워커
docs/                           # 개발 인수인계와 설계 메모
```

## 로컬 실행

Node.js LTS와 PostgreSQL이 준비된 환경에서 실행합니다.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 개발 서버는 Webpack 모드로 실행됩니다.

### 환경 변수

`.env.example`을 복사한 뒤 아래 값을 설정합니다. 비밀 값은 저장소에 커밋하지 않습니다.

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | NAVER Maps JavaScript API 클라이언트 ID |
| `NAVER_MAP_API_KEY_ID`, `NAVER_MAP_API_KEY_SECRET` | NAVER Directions·Geocoding 서버 API 인증 |
| `KAKAO_REST_API_KEY` | Kakao Local 장소 검색 인증 |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Better Auth 세션 설정 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth 설정 |
| `NEXT_PUBLIC_APP_URL` | 공유 링크 생성에 사용할 서비스 기본 URL |
| `REDIS_URL`, `ROUTE_CACHE_TTL_SECONDS` | 경로 캐시와 공유 링크 요청 제한 설정 |
| `ADMIN_EMAILS` | 쉼표로 구분한 관리자 이메일 허용 목록 |
| `CRON_SECRET` | 만료 공유 링크 정리 API 인증 비밀 값 |

### 주요 명령어

```powershell
npm run dev                   # 개발 서버 실행
npm run build                 # 프로덕션 빌드
npm run start                 # 프로덕션 서버 실행
npm test                      # 테스트 실행
npm run db:generate           # Drizzle 마이그레이션 생성
npm run db:migrate            # Drizzle 마이그레이션 적용
npm run cleanup:shared-routes # 만료 공유 링크 정리
```

배포 환경에서는 `POST /api/internal/expire-shared-routes`를 정기 실행해 만료된 공유 링크 데이터를 정리할 수 있습니다. 이 요청에는 `CRON_SECRET` 인증이 필요합니다.
