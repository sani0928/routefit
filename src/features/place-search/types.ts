import type { Place } from "@/features/route-optimization/types/route.types";

export type PlaceSearchSort = "accuracy" | "distance";

export type PlaceSearchResult = Omit<Place, "id" | "type"> & {
  providerId?: string;
  categoryName?: string;
  categoryGroupCode?: string;
  categoryGroupName?: string;
  distanceMeters?: number;
};

export type PlaceSearchResponse = {
  results: PlaceSearchResult[];
  page: number;
  isEnd: boolean;
  pageableCount: number;
  source: "KAKAO_LOCAL" | "NAVER_GEOCODING";
};
