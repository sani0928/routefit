import { AppError } from "@/lib/errors";

interface KakaoPlaceDocument {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  distance?: string;
  category_name?: string;
  category_group_code?: string;
  category_group_name?: string;
}

interface KakaoKeywordPayload {
  documents?: KakaoPlaceDocument[];
  meta?: { pageable_count?: number; is_end?: boolean };
}

export interface ExternalPlaceMatch {
  providerId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  categoryName?: string;
  categoryGroupCode?: string;
  categoryGroupName?: string;
}
export interface KakaoPlaceSearchPage {
  results: ExternalPlaceMatch[];
  page: number;
  isEnd: boolean;
  pageableCount: number;
}
export interface NearbyPlaceMatch { name: string; address?: string; latitude: number; longitude: number; distanceMeters: number; }

const LANDMARK_CATEGORIES = ["PO3", "CT1", "AT4", "SC4", "SW8", "MT1", "HP8", "CE7", "FD6", "AD5", "PK6"];

/** Looks up Korean places and preserves Kakao's own coordinates and pagination metadata. */
export async function searchKakaoPlaces(
  query: string,
  options: { page: number; size: number; sort: "accuracy" | "distance"; x?: number; y?: number },
): Promise<KakaoPlaceSearchPage | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return null;
  let response: Response;
  try {
    const params = new URLSearchParams({
      query,
      page: String(options.page),
      size: String(options.size),
      sort: options.sort,
    });
    if (options.sort === "distance" && options.x !== undefined && options.y !== undefined) {
      params.set("x", String(options.x));
      params.set("y", String(options.y));
    }
    response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
      headers: { Authorization: `KakaoAK ${apiKey}` }, signal: AbortSignal.timeout(12_000), cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new AppError("장소 검색 응답 시간이 초과되었습니다.", 504, "PLACE_SEARCH_TIMEOUT");
    throw new AppError("장소 검색 서비스에 연결하지 못했습니다.", 502, "PLACE_SEARCH_NETWORK_ERROR");
  }
  if (response.status === 401 || response.status === 403) throw new AppError("카카오 로컬 API 인증에 실패했습니다.", 502, "PLACE_SEARCH_AUTH_ERROR");
  if (response.status === 429) throw new AppError("장소 검색 API 요청 한도를 초과했습니다.", 503, "PLACE_SEARCH_RATE_LIMIT");
  if (!response.ok) throw new AppError("장소 검색 서비스가 요청을 처리하지 못했습니다.", 502, "PLACE_SEARCH_UPSTREAM_ERROR");
  const payload = await response.json() as KakaoKeywordPayload;
  const results = (payload.documents ?? []).flatMap((item) => {
    const address = item.road_address_name || item.address_name;
    const latitude = Number(item.y);
    const longitude = Number(item.x);
    if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const distance = Number(item.distance);
    return [{
      providerId: item.id,
      name: item.place_name,
      address,
      latitude,
      longitude,
      distanceMeters: Number.isFinite(distance) ? distance : undefined,
      categoryName: item.category_name,
      categoryGroupCode: item.category_group_code,
      categoryGroupName: item.category_group_name,
    }];
  });
  return {
    results,
    page: options.page,
    isEnd: payload.meta?.is_end ?? true,
    pageableCount: payload.meta?.pageable_count ?? results.length,
  };
}

/** Finds selectable named landmarks around a map click without falling back to an address. */
export async function findNearbyKakaoLandmarks(latitude: number, longitude: number): Promise<NearbyPlaceMatch[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return [];
  const headers = { Authorization: `KakaoAK ${apiKey}` };
  const responses = await Promise.all(LANDMARK_CATEGORIES.map(async (category) => {
    try {
      const params = new URLSearchParams({ category_group_code: category, x: String(longitude), y: String(latitude), radius: "100", size: "3", sort: "distance" });
      const response = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, { headers, signal: AbortSignal.timeout(8_000), cache: "no-store" });
      if (response.status === 401 || response.status === 403) throw new AppError("카카오 로컬 API 인증에 실패했습니다.", 502, "PLACE_SEARCH_AUTH_ERROR");
      if (!response.ok) return [] as KakaoPlaceDocument[];
      return ((await response.json() as KakaoKeywordPayload).documents ?? []);
    } catch (error) {
      if (error instanceof AppError) throw error;
      return [] as KakaoPlaceDocument[];
    }
  }));
  const candidates = responses.flatMap((documents) => documents.flatMap((item) => {
    const candidateLatitude = Number(item.y); const candidateLongitude = Number(item.x); const distance = Number(item.distance);
    if (!Number.isFinite(candidateLatitude) || !Number.isFinite(candidateLongitude) || !Number.isFinite(distance) || distance > 100) return [];
    return [{ name: item.place_name, address: item.road_address_name || item.address_name || undefined, latitude: candidateLatitude, longitude: candidateLongitude, distance }];
  }));
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, 5).map((candidate) => ({ name: candidate.name, address: candidate.address, latitude: candidate.latitude, longitude: candidate.longitude, distanceMeters: candidate.distance }));
}
