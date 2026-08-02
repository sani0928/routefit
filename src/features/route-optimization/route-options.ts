export const ROUTE_OPTIONS = ["trafast", "traoptimal", "tracomfort"] as const;

export type RouteOption = (typeof ROUTE_OPTIONS)[number];

export const ROUTE_OPTION_META: Record<RouteOption, {
  label: string;
  description: string;
  tone: "fast" | "balanced" | "comfort";
}> = {
  trafast: {
    label: "빠른 길 우선",
    description: "예상 소요 시간이 짧은 길을 우선합니다.",
    tone: "fast",
  },
  traoptimal: {
    label: "균형",
    description: "시간과 도로 상황을 종합해 추천합니다.",
    tone: "balanced",
  },
  tracomfort: {
    label: "편한 길 우선",
    description: "운전하기 편안한 길을 우선합니다.",
    tone: "comfort",
  },
};