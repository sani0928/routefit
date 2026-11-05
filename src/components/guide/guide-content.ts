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
  { id: "what-is-routefit", question: "루트핏이 뭐야?", answer: "루트핏(RouteFit)은 여러 방문 장소의 순서와 이동 경로를 계산하는 서비스예요. 영업, 외근, 배송, 여행처럼 여러 곳을 들르는 날에 쓸 수 있어요." },
  { id: "how-to-use", question: "어떻게 사용해?", answer: "장소나 주소를 검색해 방문 장소에 추가하세요. 2곳 이상 모이면 동선 계산 버튼을 눌러 방문 순서, 구간별 거리, 예상 시간, 교통 상태를 확인할 수 있어요. 계산한 동선은 링크로 공유할 수도 있어요." },
  { id: "route-selection-criteria", question: "경로 선택 기준이 뭐야?", answer: "방문 장소의 좌표로 가까운 곳부터 들르는 추천 순서를 만들어요. 각 구간은 실제 도로 이동 정보를 조회해 거리와 예상 시간을 계산합니다." },
  { id: "stay-time-and-lock", question: "머무는 시간? 자물쇠?", answer: "머무는 시간은 그 장소에 머무를 예상 시간이며, 도착 예정 시간에 반영돼요. 순서 보장은 선택한 장소를 지정한 순번에 고정하는 기능이에요." },
  { id: "mobile-use", question: "폰으로도 사용할 수 있어?", answer: "휴대폰에서도 장소 추가, 방문 순서 확인, 동선 계산을 모두 할 수 있어요. 설치 안내가 보이면 홈 화면에 추가해 앱처럼 쓸 수 있습니다. iOS에서는 Safari 공유 메뉴에서 홈 화면에 추가를 선택하세요." },
  { id: "member-benefits", question: "회원 혜택이 뭐야?", answer: "자주 가는 장소를 리스트로 저장하고, 방문 장소와 설정을 다음 접속에도 이어서 쓸 수 있어요. 계산한 동선은 링크로 만들어 보낼 수 있고, 받은 사람은 로그인 없이 링크를 열어볼 수 있습니다." },
  { id: "contact", question: "더 궁금한 게 있어!", answer: "문의나 개선 의견은", email: "kksan12@gmail.com", afterEmail: "으로 보내 주세요." },
] as const;

export const guideUseCases = [
  { id: "sales", title: "영업 · 외근 방문", description: "거래처 미팅 장소, 업무 거점을 한 번에 추가해 방문 순서를 확인하세요." },
  { id: "delivery", title: "배송 · 현장 업무", description: "여러 배송지와 작업 현장을 모아 방문 순서를 정리하세요." },
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
