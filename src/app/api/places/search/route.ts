import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { geocode } from "@/lib/naver-maps/geocoding";
import { searchKakaoPlaces } from "@/lib/kakao/local";
import { geocodeQuerySchema } from "@/lib/validation/route.schema";

export async function GET(request: NextRequest) {
  try {
    const query = geocodeQuerySchema.parse(request.nextUrl.searchParams.get("query") ?? "");
    const externalMatches = await searchKakaoPlaces(query);
    if (externalMatches && externalMatches.length > 0) {
      const resolved = await Promise.allSettled(externalMatches.map(async (match) => {
        const location = (await geocode(match.address))[0];
        return location ? { ...location, name: match.name, address: match.address } : null;
      }));
      const results = resolved.flatMap((outcome) => outcome.status === "fulfilled" && outcome.value ? [outcome.value] : []);
      if (results.length > 0) return NextResponse.json({ results, source: "KAKAO_LOCAL_THEN_NAVER_GEOCODE" });
    }
    return NextResponse.json({ results: await geocode(query), source: "NAVER_GEOCODING" });
  } catch (error) { return apiError(error); }
}