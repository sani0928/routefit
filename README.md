# RouteFit

NAVER Maps 기반 다중 방문지 차량 동선 최적화 MVP입니다. 출발지·최대 8개의 방문지·선택 도착지를 입력하면, 실제 도로 이동 시간을 비용으로 사용해 정확한 최적 방문 순서를 계산하고 지도에 경로를 표시합니다.

## 핵심 구성

- Next.js App Router, TypeScript, Tailwind CSS
- NAVER Maps JavaScript API v3 지도/마커/Polyline
- 서버 전용 NAVER Geocoding·Reverse Geocoding·Directions 5 연동
- 방향성이 있는 비용 행렬과 Held-Karp 비트마스크 DP
- 메모리 TTL 캐시(기본 600초), 최대 3개 병렬 외부 API 호출
- Zod 입력 검증 및 외부 API 오류의 안전한 도메인 오류 변환

## 실행

```bash
copy .env.example .env.local
npm.cmd install
npm.cmd run dev
```

`.env.local`에 다음 값을 입력합니다. 이 파일은 Git에 포함되지 않습니다.

```env
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=지도_JavaScript_Client_ID
NAVER_MAP_API_KEY_ID=서버_API_Key_ID
NAVER_MAP_API_KEY_SECRET=서버_API_Key
ROUTE_CACHE_TTL_SECONDS=600
```

NAVER Cloud 콘솔의 **Services > Application Services > Maps > Application**에서 애플리케이션을 만들고, 지도용 `Dynamic Map`을 활성화하세요. 지도 JS는 공개 Client ID만 사용하며 서버 API Key는 Route Handler에서만 사용합니다. 지도 SDK 스크립트는 현재 문서 기준 `ncpKeyId` 파라미터를 사용합니다. [NAVER 지도 JavaScript API v3 인증 안내](https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html)

## API

- `GET /api/places/search?query=...` — 카카오 로컬 키워드 검색에서 반환한 주소를 NAVER Maps Geocoding에 전달해 좌표로 변환
- `GET /api/maps/geocode?query=...` — 도로명·지번 주소를 좌표로 변환
- `GET /api/maps/reverse-geocode?lat=...&lng=...` — 좌표 주소 조회
- `POST /api/maps/route-cost` — 두 지점의 차량 이동 비용
- `POST /api/routes/optimize` — 비용 행렬 생성·최적화·경로 Polyline 반환

Directions는 현재 NAVER Cloud의 Directions 5를 사용합니다. 엔드포인트는 `GET https://maps.apigw.ntruss.com/map-direction/v1/driving`이고 서버에서 `x-ncp-apigw-api-key-id`, `x-ncp-apigw-api-key`를 전송합니다. 한 요청의 경유지는 최대 5개이므로, RouteFit은 자체적으로 모든 쌍의 단일 구간을 조회해 8개 방문지까지 안전하게 지원합니다. [Directions 5 공식 문서](https://api.ncloud-docs.com/docs/en/ai-naver-mapsdirections-driving)

## 최적화 방식

`dp[방문한_집합][현재_방문지]`에 출발지부터의 최소 시간을 저장합니다. 모든 종착 후보를 비교해 폐회로(출발지 복귀), 고정 도착지, 자유 도착지를 각각 정확히 처리하며 경로는 predecessor 테이블에서 복원합니다. 시간 복잡도는 `O(W²·2^W)`, 공간 복잡도는 `O(W·2^W)`이고, MVP 제한인 `W ≤ 8`에 적합합니다. 비용 행렬은 대칭으로 가정하지 않습니다.

## 테스트 및 배포

```bash
npm.cmd test
npm.cmd run build
```

단위 테스트는 외부 API 없이 폐회로·고정/자유 도착지·방향성·0/1개 방문지·도달 불가 구간을 검증합니다. Vercel 등 Node.js를 지원하는 환경에 배포할 수 있으며, 배포 환경 변수에는 위 네 값을 등록해야 합니다.

## 제한 및 확장

현재 캐시는 단일 인스턴스 메모리 캐시이고, 장소/계산 이력은 저장하지 않습니다. 운영 다중 인스턴스에서는 Redis, 이력에는 PostgreSQL/Prisma를 추가하세요. 8개 초과 방문지는 `RouteOptimizer` 인터페이스에 Nearest Neighbor + 2-opt 전략을 구현해 교체할 수 있습니다. Directions 요청 수와 요금/할당량은 NAVER Cloud 콘솔에서 반드시 확인하세요.
