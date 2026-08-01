import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { reverseGeocode } from "@/lib/naver-maps/geocoding";
import { routeCostSchema } from "@/lib/validation/route.schema";

export async function GET(request: NextRequest) {
  try {
    const parsed = routeCostSchema.shape.origin.parse({ latitude: Number(request.nextUrl.searchParams.get("lat")), longitude: Number(request.nextUrl.searchParams.get("lng")) });
    return NextResponse.json(await reverseGeocode(parsed.latitude, parsed.longitude));
  } catch (error) { return apiError(error); }
}
