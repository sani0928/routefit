import type { OptimizationResponse } from "@/features/route-optimization/types/route.types";

export type SharedRouteSnapshot = {
  version: 1;
  returnToStart: boolean;
  result: OptimizationResponse;
};

export type SharedRouteState = "active" | "expired";

export type SharedRouteRecord = {
  id: string;
  shareId: string;
  state: SharedRouteState;
  snapshot: SharedRouteSnapshot | null;
  createdAt: Date;
  expiresAt: Date;
  purgedAt: Date | null;
};

export const isSharedCurrentLocation = (place: SharedRouteSnapshot["result"]["orderedPlaces"][number]) => place.isCurrentLocation === true || place.name === "현재 위치";

export function sanitizeSharedRouteSnapshot(snapshot: SharedRouteSnapshot): SharedRouteSnapshot {
  return {
    ...snapshot,
    result: {
      ...snapshot.result,
      orderedPlaces: snapshot.result.orderedPlaces.map((place) => ({
        ...place,
        // 현재 위치의 텍스트 주소는 공유 데이터 자체에 남기지 않는다.
        address: isSharedCurrentLocation(place) ? "" : place.address,
      })),
    },
  };
}
