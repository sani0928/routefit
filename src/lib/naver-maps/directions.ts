import type { Place, RouteSegment, RouteTrafficSection } from "@/features/route-optimization/types/route.types";
import { AppError } from "@/lib/errors";
import { getCachedRoute, routeCacheKey, setCachedRoute } from "@/lib/cache/route-cache";
import { naverFetch } from "./client";

const DIRECTIONS_OPTION = "traoptimal";
interface DirectionsSection { pointIndex?: number; pointCount?: number; distance?: number; congestion?: number; speed?: number; }
interface DirectionsRoute { summary?: { distance?: number; duration?: number; tollFare?: number }; path?: [number, number][]; section?: DirectionsSection[]; }
interface DirectionsPayload { code: number; message?: string; route?: { traoptimal?: DirectionsRoute[] }; }

export async function drivingRoute(from: Place, to: Place, onExternalRequest?: () => void): Promise<RouteSegment> {
  const key = routeCacheKey(from, to);
  const cached = await getCachedRoute(key);
  if (cached) return { ...cached, fromId: from.id, toId: to.id, trafficSections: cached.trafficSections ?? [] };
  const start = `${from.longitude},${from.latitude}`;
  const goal = `${to.longitude},${to.latitude}`;
  onExternalRequest?.();
  const payload = await naverFetch(`/map-direction/v1/driving?start=${encodeURIComponent(start)}&goal=${encodeURIComponent(goal)}&option=${DIRECTIONS_OPTION}&cartype=1`) as DirectionsPayload;
  if (payload.code !== 0) {
    const code = payload.code === 1 ? "SAME_LOCATION" : "ROUTE_NOT_FOUND";
    throw new AppError(payload.code === 1 ? "출발지와 목적지가 동일합니다." : "차량 경로를 찾을 수 없습니다.", 422, code);
  }
  const route = payload.route?.traoptimal?.[0];
  const summary = route?.summary;
  if (!route || !summary || typeof summary.duration !== "number" || typeof summary.distance !== "number") {
    throw new AppError("경로 응답 형식이 올바르지 않습니다.", 502, "INVALID_ROUTE_RESPONSE");
  }
  const segment: RouteSegment = {
    fromId: from.id, toId: to.id, distanceMeters: summary.distance,
    durationMilliseconds: summary.duration, tollFare: summary.tollFare ?? 0, path: route.path ?? [],
    trafficSections: (route.section ?? []).flatMap((section): RouteTrafficSection[] => {
      const congestion = section.congestion;
      if (congestion !== 0 && congestion !== 1 && congestion !== 2 && congestion !== 3) return [];
      return [{
        pointIndex: Math.max(0, section.pointIndex ?? 0),
        pointCount: Math.max(0, section.pointCount ?? 0),
        distanceMeters: Math.max(0, section.distance ?? 0),
        congestion,
        ...(typeof section.speed === "number" ? { speedKph: section.speed } : {}),
      }];
    }),
  };
  await setCachedRoute(key, segment);
  return segment;
}
