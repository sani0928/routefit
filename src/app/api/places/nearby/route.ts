import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/errors";
import { findNearbyKakaoLandmarks } from "@/lib/kakao/local";

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().finite().min(33).max(39),
  lng: z.coerce.number().finite().min(124).max(132),
});

export async function GET(request: NextRequest) {
  try {
    const { lat, lng } = nearbyQuerySchema.parse({ lat: request.nextUrl.searchParams.get("lat"), lng: request.nextUrl.searchParams.get("lng") });
    return NextResponse.json({ results: await findNearbyKakaoLandmarks(lat, lng) });
  } catch (error) { return apiError(error); }
}