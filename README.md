# RouteFit

**여러 방문 장소를 가장 효율적인 순서로 연결하는 동선 최적화 서비스**입니다. 장소를 검색하거나 지도에서 선택해 방문 장소를 만들고, 실시간 교통정보를 반영한 차량 이동 경로를 한눈에 확인할 수 있습니다.

> [www.routefit.co.kr](https://www.routefit.co.kr)

## RouteFit으로 할 수 있는 일

- **장소·주소 검색**: 일부 이름만 입력해도 연관도가 높은 장소를 찾아 추가합니다. 검색 결과에는 음식점, 카페, 병원 등 장소 카테고리에 맞는 아이콘도 표시됩니다.
- **지도에서 바로 추가**: 지도에서 원하는 위치를 선택한 뒤, 가까운 장소 또는 해당 위치의 주소를 골라 방문 장소에 넣을 수 있습니다.
- **동선 최적화**: 현재 교통상황을 반영해 방문 순서를 계산하고, 구간별 경로·거리·예상 이동 시간을 보여 줍니다.
- **나만의 조건 반영**: 출발지 복귀, 특정 방문 순서 고정, 장소별 머무는 시간을 설정할 수 있습니다.
- **보기 쉬운 지도**: 최적화 뒤에는 구간마다 다른 색상과 순서 마커로 경로를 구분합니다.
- **내 장소 관리**: 로그인하면 자주 가는 장소를 색상별 리스트로 저장하고, 필요할 때 현재 방문 장소에 추가할 수 있습니다.

방문 장소는 한 동선에 최대 **15곳**까지 추가할 수 있습니다.

## 사용 방법

1. 좌측 검색창에서 장소나 주소를 찾거나 지도에서 위치를 선택합니다.
2. 방문 장소의 순서를 드래그해서 조정합니다. 반드시 지켜야 할 순서는 자물쇠 아이콘으로 고정할 수 있습니다.
3. 필요하면 출발지로 복귀를 켜고, 중간 경유지에는 머무는 시간을 설정합니다.
4. **동선 최적화 계산**을 누르면 최신 교통정보 기준의 추천 순서와 구간별 경로가 표시됩니다.
5. 구간 상세를 선택하면 해당 구간의 출발·도착 장소와 예상 시간을 확인할 수 있습니다.

## 회원 기능

RouteFit의 기본 검색·지도·동선 최적화 기능은 로그인 없이 사용할 수 있습니다. Google 로그인 회원은 다음 기능을 추가로 이용할 수 있습니다.

- 브라우저를 다시 열거나 새로고침해도 방문 장소 배치, 머무는 시간, 순서 고정 설정 유지
- 기본 **즐겨찾기**를 포함한 장소 리스트 관리
- 리스트별 전용 색상 지정 및 지도 마커 색상 동기화
- 저장한 장소를 현재 방문 장소에 한 번에 추가

회원은 장소 리스트를 최대 **50개**, 각 리스트에는 장소를 최대 **100곳**까지 저장할 수 있습니다. 비회원의 방문 장소는 현재 브라우저 세션에서만 유지됩니다.

## 동선 계산 기준

RouteFit은 도로 거리만 단순 비교하지 않고 NAVER 지도 경로 API가 제공하는 **현재 교통상황 기반 이동 시간**을 활용합니다. 따라서 교통 흐름, 도로망, 통행료가 반영된 실제 차량 경로를 기준으로 방문 순서를 계산합니다.

머무는 시간을 설정한 경우 이동 시간에 합산해 전체 예상 소요 시간을 표시합니다. 계산 결과는 저장하지 않으며, 다시 계산할 때마다 최신 교통정보로 갱신됩니다.

## 모바일에서도 사용하세요

모바일 화면에서는 지도와 패널이 화면 크기에 맞춰 재배치됩니다. 지도 확대·축소, 현재 위치 확인, 장소 검색, 방문 장소 관리와 동선 계산을 모두 사용할 수 있습니다.

---

## 개발 안내

### 시작하기

```bash
copy .env.example .env.local
npm install
npm run dev
```

Windows 명령 프롬프트나 Git Bash에서는 필요에 따라 `npm.cmd`를 사용하세요.

### 환경 변수

`.env.example`을 복사한 뒤 아래 값을 채웁니다. 민감한 값이 담긴 `.env.local`은 Git에 올리지 않습니다.

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | NAVER Maps JavaScript API 클라이언트 ID |
| `NAVER_MAP_API_KEY_ID` / `NAVER_MAP_API_KEY_SECRET` | NAVER 지도 서버 API 인증 |
| `KAKAO_REST_API_KEY` | 장소·키워드 검색 |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth 세션 설정 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google 로그인 OAuth 설정 |

Google OAuth 승인 리디렉션 URI는 개발 환경에서 `http://localhost:3000/api/auth/callback/google`, 운영 환경에서 `https://www.routefit.co.kr/api/auth/callback/google`을 등록합니다.

### 주요 기술

- Next.js App Router · React · TypeScript
- NAVER Maps JavaScript API 및 Directions API
- Kakao Local API 장소 검색
- Better Auth + Google OAuth
- Drizzle ORM + PostgreSQL
- Lucide React 아이콘

### 데이터베이스와 검증

```bash
# 스키마 변경 뒤 마이그레이션 파일 생성 및 적용
npm run db:generate
npm run db:migrate

# 테스트와 프로덕션 빌드
npm test
npm run build
```

운영 환경에서는 웹 앱과 PostgreSQL의 환경 변수 값을 각각 설정해야 합니다. Railway PostgreSQL을 사용할 경우 TLS 연결 문자열을 `DATABASE_URL`로 등록하고, `BETTER_AUTH_URL`은 실제 서비스 주소와 일치시켜 주세요.