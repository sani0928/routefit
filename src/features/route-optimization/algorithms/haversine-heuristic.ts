import type { FixedVisitOrder, Place, RouteOptimizationInput, RouteOptimizationResult } from "../types/route.types";

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(from: Pick<Place, "latitude" | "longitude">, to: Pick<Place, "latitude" | "longitude">): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const halfChord = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(halfChord));
}

function fixedPositions(fixedVisitOrders: FixedVisitOrder[]) {
  return new Map(fixedVisitOrders.map(({ placeId, visitOrder }) => [placeId, visitOrder]));
}

function routeDistance(start: Place, waypoints: Place[], end: Place | null): number {
  const nodes = [start, ...waypoints, ...(end ? [end] : [])];
  return nodes.slice(1).reduce((total, node, index) => total + haversineMeters(nodes[index], node), 0);
}

function canReverseAtFixedPositions(waypoints: Place[], startIndex: number, endIndex: number, fixed: Map<string, number>) {
  for (let offset = 0; offset <= endIndex - startIndex; offset += 1) {
    const moved = waypoints[endIndex - offset];
    const expectedPosition = startIndex + offset + 2;
    const fixedPosition = fixed.get(moved.id);
    if (fixedPosition !== undefined && fixedPosition !== expectedPosition) return false;
  }
  return true;
}

function improveWithTwoOpt(start: Place, initialWaypoints: Place[], end: Place | null, fixed: Map<string, number>) {
  let waypoints = initialWaypoints;
  let bestDistance = routeDistance(start, waypoints, end);
  let improved = true;
  let pass = 0;

  while (improved && pass < initialWaypoints.length) {
    improved = false;
    pass += 1;
    for (let startIndex = 0; startIndex < waypoints.length - 1 && !improved; startIndex += 1) {
      for (let endIndex = startIndex + 1; endIndex < waypoints.length; endIndex += 1) {
        if (!canReverseAtFixedPositions(waypoints, startIndex, endIndex, fixed)) continue;
        const candidate = [
          ...waypoints.slice(0, startIndex),
          ...waypoints.slice(startIndex, endIndex + 1).reverse(),
          ...waypoints.slice(endIndex + 1),
        ];
        const candidateDistance = routeDistance(start, candidate, end);
        if (candidateDistance + 0.01 >= bestDistance) continue;
        waypoints = candidate;
        bestDistance = candidateDistance;
        improved = true;
        break;
      }
    }
  }
  return waypoints;
}

/**
 * Builds a no-API route order from geographic distance. Directions are fetched
 * afterwards only for the consecutive legs in this resulting order.
 */
export function optimizeHaversineRoute(input: RouteOptimizationInput): RouteOptimizationResult {
  const fixed = fixedPositions(input.fixedVisitOrders ?? []);
  const remaining = new Map(input.waypoints.map((place) => [place.id, place]));
  const orderedWaypoints: Place[] = [];
  let current = input.start;

  for (let visitOrder = 2; visitOrder <= input.waypoints.length + 1; visitOrder += 1) {
    const forced = Array.from(remaining.values()).find((place) => fixed.get(place.id) === visitOrder);
    const candidates = forced
      ? [forced]
      : Array.from(remaining.values()).filter((place) => fixed.get(place.id) === undefined);
    if (candidates.length === 0) throw new Error("고정 방문 순서를 만족하는 경로를 만들 수 없습니다.");

    const next = candidates.reduce((closest, candidate) => (
      haversineMeters(current, candidate) < haversineMeters(current, closest) ? candidate : closest
    ));
    orderedWaypoints.push(next);
    remaining.delete(next.id);
    current = next;
  }

  const end = input.returnToStart ? input.start : input.destination ?? null;
  const improvedWaypoints = improveWithTwoOpt(input.start, orderedWaypoints, end, fixed);
  const orderedPlaceIds = [input.start.id, ...improvedWaypoints.map((place) => place.id), ...(end ? [end.id] : [])];
  return { orderedPlaceIds, totalDurationMilliseconds: 0 };
}
