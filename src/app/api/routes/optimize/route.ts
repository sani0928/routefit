import { NextRequest, NextResponse } from "next/server";
import { apiError, AppError } from "@/lib/errors";
import { optimizeSchema } from "@/lib/validation/route.schema";
import { optimizeHaversineRoute } from "@/features/route-optimization/algorithms/haversine-heuristic";
import { drivingRoute } from "@/lib/naver-maps/directions";
import type { Place, RouteSegment } from "@/features/route-optimization/types/route.types";

export async function POST(request: NextRequest) {
  let directionsRequests = 0;
  let debugNodeCount = 0;
  try {
    const input = optimizeSchema.parse(await request.json());
    const calculationStartedAt = Date.now();
    const start: Place = { ...input.start, type: "START" };
    const waypoints: Place[] = input.waypoints.map((place) => ({ ...place, type: "WAYPOINT" }));
    const destination: Place | null = input.destination ? { ...input.destination, type: "DESTINATION" } : null;
    const nodes = [start, ...waypoints, ...(destination ? [destination] : [])];
    debugNodeCount = nodes.length;
    const getRoute = (from: Place, to: Place) => drivingRoute(from, to, () => { directionsRequests += 1; });
    const optimized = optimizeHaversineRoute({ start, waypoints, destination, returnToStart: input.returnToStart, fixedVisitOrders: input.fixedVisitOrders });
    const byId = new Map(nodes.map((place) => [place.id, place]));
    const segments: RouteSegment[] = [];
    for (let i = 0; i < optimized.orderedPlaceIds.length - 1; i += 1) {
      const fromId = optimized.orderedPlaceIds[i]; const toId = optimized.orderedPlaceIds[i + 1];
      if (fromId === toId) continue;
      const from = byId.get(fromId); const to = byId.get(toId);
      if (!from || !to) throw new AppError("장소 정보를 찾을 수 없습니다.", 422, "INVALID_ROUTE");
      segments.push(await getRoute(from, to));
    }
    const orderedPlaces = optimized.orderedPlaceIds.map((id) => byId.get(id)).filter((place): place is Place => Boolean(place));
    const visitPlaces = orderedPlaces.slice(1, -1);
    const totalStayDurationMinutes = visitPlaces.reduce((sum, place) => sum + (place.stayDurationMinutes ?? 0), 0);
    return NextResponse.json({
      orderedPlaces, segments,
      summary: {
        totalDistanceMeters: segments.reduce((sum, segment) => sum + segment.distanceMeters, 0),
        totalDurationMilliseconds: segments.reduce((sum, segment) => sum + segment.durationMilliseconds, 0),
        totalTollFare: segments.reduce((sum, segment) => sum + (segment.tollFare ?? 0), 0),
        totalStayDurationMinutes,
        calculatedAt: new Date().toISOString(),
        calculationDurationMilliseconds: Date.now() - calculationStartedAt,
        optimizationMethod: "HAVERSINE_SINGLE",
      },
      path: segments.flatMap((segment, index) => index === 0 ? segment.path : segment.path.slice(1)),
    });
  } catch (error) { return apiError(error); }
  finally {
    console.info("[RouteFit] Directions API requests", {
      strategy: "haversine-single",
      nodeCount: debugNodeCount,
      requests: directionsRequests,
    });
  }
}
