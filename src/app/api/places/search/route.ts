import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { geocode } from "@/lib/naver-maps/geocoding";
import { searchKakaoPlaces, type ExternalPlaceMatch } from "@/lib/kakao/local";
import { getSessionUser } from "@/lib/member/api";
import { getPlaceListMatches } from "@/lib/member/repository";
import { placeSearchSchema } from "@/lib/validation/route.schema";
import type { PlaceSearchResult } from "@/features/place-search/types";

const KAKAO_PROVIDER_PAGE_SIZE = 15;

async function attachSavedListIds(results: PlaceSearchResult[], userId: string) {
  const providerIds = [...new Set(results.flatMap((place) => place.providerId ? [place.providerId] : []))];
  if (providerIds.length === 0) return results;

  const matches = await getPlaceListMatches(userId, providerIds);
  return results.map((place) => {
    const savedListIds = place.providerId ? matches[place.providerId] : undefined;
    return savedListIds?.length ? { ...place, savedListIds } : place;
  });
}

export async function GET(request: NextRequest) {
  try {
    const sessionUserPromise = getSessionUser().catch(() => null);
    const input = placeSearchSchema.parse({
      query: request.nextUrl.searchParams.get("query") ?? "",
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      size: request.nextUrl.searchParams.get("size") ?? undefined,
      sort: request.nextUrl.searchParams.get("sort") ?? undefined,
      x: request.nextUrl.searchParams.get("x") ?? undefined,
      y: request.nextUrl.searchParams.get("y") ?? undefined,
    });
    const offset = (input.page - 1) * input.size;
    const firstProviderPage = Math.floor(offset / KAKAO_PROVIDER_PAGE_SIZE) + 1;
    const skip = offset % KAKAO_PROVIDER_PAGE_SIZE;
    const needed = skip + input.size;
    const providerResults: ExternalPlaceMatch[] = [];
    let providerPage = firstProviderPage;
    let providerIsEnd = false;
    let pageableCount = 0;
    let kakaoAvailable = true;

    while (providerResults.length < needed && !providerIsEnd && providerPage <= 45) {
      const providerResponse = await searchKakaoPlaces(input.query, {
        ...input,
        page: providerPage,
        size: KAKAO_PROVIDER_PAGE_SIZE,
      });
      if (!providerResponse) {
        kakaoAvailable = false;
        break;
      }
      providerResults.push(...providerResponse.results);
      pageableCount = providerResponse.pageableCount;
      providerIsEnd = providerResponse.isEnd || providerResponse.results.length === 0;
      providerPage += 1;
    }

    const results = providerResults.slice(skip, skip + input.size);
    if (kakaoAvailable && (results.length > 0 || offset > 0)) {
      const user = await sessionUserPromise;
      const enrichedResults = user ? await attachSavedListIds(results, user.id).catch(() => results) : results;
      const externalPage = {
        results: enrichedResults,
        page: input.page,
        isEnd: providerIsEnd || offset + results.length >= pageableCount,
        pageableCount,
      };
      return NextResponse.json({ ...externalPage, source: "KAKAO_LOCAL" });
    }

    // Naver geocoding is a non-pageable fallback. Never repeat it after the first page.
    if (input.page > 1) return NextResponse.json({ results: [], page: input.page, isEnd: true, pageableCount: 0, source: "NAVER_GEOCODING" });
    const fallbackResults = await geocode(input.query);
    const user = await sessionUserPromise;
    const enrichedFallbackResults = user ? await attachSavedListIds(fallbackResults, user.id).catch(() => fallbackResults) : fallbackResults;
    return NextResponse.json({ results: enrichedFallbackResults, page: 1, isEnd: true, pageableCount: fallbackResults.length, source: "NAVER_GEOCODING" });
  } catch (error) { return apiError(error); }
}
