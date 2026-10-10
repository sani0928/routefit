import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { drivingRoute } from "@/lib/naver-maps/directions";
import { recordDirectionsUsage } from "@/lib/admin/repository";
import { getSessionUser } from "@/lib/member/api";
import { routeCostSchema } from "@/lib/validation/route.schema";

export async function POST(request: NextRequest) {
  let externalDirectionsRequests = 0;
  let cacheHits = 0;
  let failed = false;
  let calculationStarted = false;
  let userId: string | null = null;
  try {
    const body = routeCostSchema.parse(await request.json());
    userId = (await getSessionUser().catch(() => null))?.id ?? null;
    calculationStarted = true;
    const [origin, destination] = [body.origin, body.destination].map((p, index) => ({ ...p, id: String(index), name: "지점", type: "WAYPOINT" as const }));
    return NextResponse.json(await drivingRoute(origin, destination, (source) => {
      if (source === "external") externalDirectionsRequests += 1;
      else cacheHits += 1;
    }));
  } catch (error) {
    failed = true;
    return apiError(error);
  } finally {
    if (calculationStarted) {
      try {
        await recordDirectionsUsage({ userId, externalDirectionsRequests, cacheHits, failedRequests: failed ? 1 : 0 });
      } catch (error) {
        console.error("[RouteFit] Directions usage could not be recorded", error);
      }
    }
  }
}
