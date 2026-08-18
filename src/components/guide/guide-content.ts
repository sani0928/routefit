export type GuideStage = "places" | "calculating" | "result";

export type GuidePlace = {
  id: string;
  name: string;
  position: { x: number; y: number };
};

export type GuideFaqMessage = {
  id: string;
  role: "question" | "answer";
  content: string;
  email?: string;
  afterEmail?: string;
};

export type GuideFaqItem = {
  id: string;
  question: string;
  answer: string;
  email?: string;
  afterEmail?: string;
};

export const guidePages = [
  { id: "guide-intro", label: "소개" },
  { id: "guide-workspace", label: "체험" },
  { id: "guide-tips", label: "활용" },
  { id: "guide-faq", label: "FAQ" },
] as const;

export const guideFaqItems: readonly GuideFaqItem[] = [
  { id: "what-is-routefit", question: "루트핏이 뭐야?", answer: "루트핏(RouteFit)은 여러 방문 장소를 한 번에 정리하고, 이동 거리와 예상 시간을 바탕으로 방문 순서를 확인하는 동선 최적화 서비스예요. 영업이나 외근, 배송, 여행 일정, 데이트 코스처럼 여러 곳을 방문하는 날에 유용해요." },
  { id: "how-to-use", question: "어떻게 사용해?", answer: "장소나 주소를 검색해 방문 장소에 추가한 뒤, 2곳 이상 모이면 경로 최적화 계산 버튼을 눌러 보세요. 추천 방문 순서와 구간별 거리, 예상 시간, 교통 상태를 한눈에 확인할 수 있어요. 공유 기능을 통해 내 동선을 친구와 함께 볼 수도 있어요!" },
  { id: "route-selection-criteria", question: "경로 선택 기준이 뭐야?", answer: "방문 장소의 좌표를 기준으로 출발지에서 가까운 곳부터 이동할 수 있도록 순서를 만들고, 선택한 각 구간은 실제 도로 이동 정보를 조회해 거리와 예상 시간을 계산해요. 여러 장소를 방문할 때 이동 동선을 빠르게 정리할 수 있어요." },
  { id: "stay-time-and-lock", question: "머무는 시간? 자물쇠?", answer: "머무는 시간은 해당 장소에 머물 예상 시간으로, 전체 일정의 도착 예정 시간에 함께 반영돼요. 순서 보장은 원하는 장소를 해당 순서에 고정해 경로를 계산해도 그 순서가 바뀌지 않도록 해줘요." },
  { id: "mobile-use", question: "폰으로도 사용할 수 있어?", answer: "폰에서도 장소 추가, 방문 순서 확인, 경로 계산을 모두 사용할 수 있어요. 설치 안내가 보이면 홈 화면에 추가해 앱처럼 사용할 수도 있어요! iOS라면 Safari에서 공유 후 홈 화면에 추가를 사용해보세요." },
  { id: "member-benefits", question: "회원 혜택이 뭐야?", answer: "회원은 자주 가는 장소를 장소 리스트로 저장해 다음 일정에 다시 활용할 수 있어요. 방문 장소도 사라지지 않고 유지되기 때문에 동선을 더 빠르게 준비할 수 있어요." },
  { id: "contact", question: "더 궁금한 게 있어!", answer: "궁금한 점이나 문의 사항이 있으면", email: "kksan12@gmail.com", afterEmail: "으로 연락해주세요. 다양한 피드백은 항상 환영합니다!" },
] as const;

export const guideUseCases = [
  { id: "sales", title: "영업 · 외근 방문", description: "거래처 미팅 장소, 업무 거점을 한 번에 추가해 방문 순서를 확인하세요." },
  { id: "delivery", title: "배송 · 현장 업무", description: "여러 배송지와 작업 현장을 모아 이동 동선을 빠르게 정리할 수 있습니다." },
  { id: "travel", title: "여행 일정", description: "관광지, 식당, 숙소처럼 하루에 들를 곳이 많은 여행 계획에 사용해 보세요." },
  { id: "date", title: "데이트 · 약속 코스", description: "카페, 전시, 식사처럼 여러 약속 장소를 자연스러운 순서로 이어 보세요." },
] as const;

export const initialGuidePlace: GuidePlace = {
  id: "current-location",
  name: "현재 위치",
  position: { x: 16, y: 73 },
};

export const suggestedGuidePlaces = [
  { id: "city-hall", name: "시청", position: { x: 38, y: 25 } },
  { id: "central-library", name: "중앙도서관", position: { x: 69, y: 69 } },
  { id: "neighborhood-park", name: "근린공원", position: { x: 82, y: 25 } },
] as const satisfies readonly GuidePlace[];

export const optimizedGuideVisitSequences: Record<string, string[]> = {
  "central-library|city-hall": ["city-hall", "central-library"],
  "city-hall|neighborhood-park": ["city-hall", "neighborhood-park"],
  "central-library|neighborhood-park": ["neighborhood-park", "central-library"],
  "central-library|city-hall|neighborhood-park": ["city-hall", "neighborhood-park", "central-library"],
};

export const guideRouteEstimates: Record<string, { distanceKm: number; travelMinutes: number }> = {
  "central-library|city-hall": { distanceKm: 14.2, travelMinutes: 31 },
  "city-hall|neighborhood-park": { distanceKm: 16.8, travelMinutes: 36 },
  "central-library|neighborhood-park": { distanceKm: 19.5, travelMinutes: 42 },
  "central-library|city-hall|neighborhood-park": { distanceKm: 24.3, travelMinutes: 49 },
};

