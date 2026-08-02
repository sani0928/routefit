import { NextRequest, NextResponse } from "next/server";
import { apiError, AppError } from "@/lib/errors";
import { optimizeSchema } from "@/lib/validation/route.schema";
import { buildCostMatrix } from "@/features/route-optimization/services/cost-matrix.service";
import { optimizeRoute } from "@/features/route-optimization/services/route-optimizer.service";
import { drivingRoute } from "@/lib/naver-maps/directions";
import type { Place, RouteSegment } from "@/features/route-optimization/types/route.types";

export async function POST(request: NextRequest) {
  try {
    const input = optimizeSchema.parse(await request.json());
    const calculationStartedAt = Date.now();
    const start: Place = { ...input.start, type: "START" };
    const waypoints: Place[] = input.waypoints.map((place) => ({ ...place, type: "WAYPOINT" }));
    const destination: Place | null = input.destination ? { ...input.destination, type: "DESTINATION" } : null;
    const nodes = [start, ...waypoints, ...(destination ? [destination] : [])];
    const matrix = await buildCostMatrix(nodes, (from, to) => drivingRoute(from, to, input.routeOption));
    const optimized = optimizeRoute({ start, waypoints, destination, returnToStart: input.returnToStart, costs: matrix, fixedVisitOrders: input.fixedVisitOrders });
    const byId = new Map(nodes.map((place) => [place.id, place]));
    const byLeg = new Map(matrix.map((segment) => [`${segment.fromId}:${segment.toId}`, segment]));
    const segments: RouteSegment[] = [];
    for (let i = 0; i < optimized.orderedPlaceIds.length - 1; i += 1) {
      const fromId = optimized.orderedPlaceIds[i]; const toId = optimized.orderedPlaceIds[i + 1];
      if (fromId === toId) continue;
      if (!byLeg.get(`${fromId}:${toId}`)) throw new AppError("최종 경로 구간을 찾을 수 없습니다.", 422, "ROUTE_NOT_FOUND");
      const from = byId.get(fromId); const to = byId.get(toId);
      if (!from || !to) throw new AppError("장소 정보를 찾을 수 없습니다.", 422, "INVALID_ROUTE");
      segments.push(await drivingRoute(from, to, input.routeOption));
    }
    const orderedPlaces = optimized.orderedPlaceIds.map((id) => byId.get(id)).filter((place): place is Place => Boolean(place));
    const visitPlaces = orderedPlaces.slice(1, -1);
    const totalStayDurationMinutes = visitPlaces.reduce((sum, place) => sum + (place.stayDurationMinutes ?? 0), 0);
    return NextResponse.json({
      orderedPlaces, segments,
      summary: {
        totalDistanceMeters: segments.reduce((sum, segment) => sum + segment.distanceMeters, 0),
        totalDurationMilliseconds: optimized.totalDurationMilliseconds,
        totalTollFare: segments.reduce((sum, segment) => sum + (segment.tollFare ?? 0), 0),
        totalStayDurationMinutes,
        calculatedAt: new Date().toISOString(),
        calculationDurationMilliseconds: Date.now() - calculationStartedAt,
        routeOption: input.routeOption,
      },
      path: segments.flatMap((segment, index) => index === 0 ? segment.path : segment.path.slice(1)),
    });
  } catch (error) { return apiError(error); }
}