import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { geocode } from "@/lib/naver-maps/geocoding";
import { geocodeQuerySchema } from "@/lib/validation/route.schema";

export async function GET(request: NextRequest) {
  try { const query = geocodeQuerySchema.parse(request.nextUrl.searchParams.get("query") ?? ""); return NextResponse.json({ results: await geocode(query) }); }
  catch (error) { return apiError(error); }
}
