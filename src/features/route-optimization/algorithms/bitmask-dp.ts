import type { FixedVisitOrder, RouteCost, RouteOptimizationInput, RouteOptimizationResult, RouteOptimizer } from "../types/route.types";

type Matrix = Map<string, Map<string, RouteCost>>;
type FixedPositionMap = Map<string, number>;
const INF = Number.POSITIVE_INFINITY;

function costOf(matrix: Matrix, from: string, to: string): RouteCost | undefined {
  return matrix.get(from)?.get(to);
}

export function toCostMatrix(costs: RouteCost[]): Matrix {
  const matrix: Matrix = new Map();
  for (const cost of costs) {
    const row = matrix.get(cost.fromId) ?? new Map<string, RouteCost>();
    row.set(cost.toId, cost);
    matrix.set(cost.fromId, row);
  }
  return matrix;
}

/** Restores a start -> waypoint... sequence from a Held-Karp predecessor table. */
export function restorePath(previous: number[][], mask: number, last: number): number[] {
  const reversed: number[] = [];
  let current = last;
  let visited = mask;
  while (current !== -1) {
    reversed.push(current);
    const parent = previous[visited][current];
    visited &= ~(1 << current);
    current = parent;
  }
  return reversed.reverse();
}

interface DpResult { dp: number[][]; previous: number[][]; fullMask: number; }

function createFixedPositionMap(fixedVisitOrders: FixedVisitOrder[]): FixedPositionMap {
  return new Map(fixedVisitOrders.map(({ placeId, visitOrder }) => [placeId, visitOrder]));
}

function canVisitAtPosition(placeId: string, visitOrder: number, fixedPositions: FixedPositionMap): boolean {
  const fixedOrder = fixedPositions.get(placeId);
  if (fixedOrder !== undefined && fixedOrder !== visitOrder) return false;
  for (const [fixedPlaceId, position] of fixedPositions) {
    if (position === visitOrder && fixedPlaceId !== placeId) return false;
  }
  return true;
}

function visitedCount(mask: number): number {
  let count = 0;
  let value = mask;
  while (value) { count += value & 1; value >>>= 1; }
  return count;
}

/**
 * Held-Karp dynamic programming: O(W²×2^W) time and O(W×2^W) space.
 * A fixed visit order only permits that waypoint at its requested global position.
 */
function buildDp(startId: string, waypointIds: string[], matrix: Matrix, fixedVisitOrders: FixedVisitOrder[] = []): DpResult {
  const size = waypointIds.length;
  const fullMask = (1 << size) - 1;
  const dp = Array.from({ length: 1 << size }, () => Array<number>(size).fill(INF));
  const previous = Array.from({ length: 1 << size }, () => Array<number>(size).fill(-1));
  const fixedPositions = createFixedPositionMap(fixedVisitOrders);

  for (let end = 0; end < size; end += 1) {
    if (!canVisitAtPosition(waypointIds[end], 2, fixedPositions)) continue;
    const leg = costOf(matrix, startId, waypointIds[end]);
    if (leg) dp[1 << end][end] = leg.durationMilliseconds;
  }

  for (let mask = 1; mask <= fullMask; mask += 1) {
    for (let current = 0; current < size; current += 1) {
      if ((mask & (1 << current)) === 0 || !Number.isFinite(dp[mask][current])) continue;
      for (let next = 0; next < size; next += 1) {
        if (mask & (1 << next)) continue;
        const nextVisitOrder = visitedCount(mask) + 2;
        if (!canVisitAtPosition(waypointIds[next], nextVisitOrder, fixedPositions)) continue;
        const leg = costOf(matrix, waypointIds[current], waypointIds[next]);
        if (!leg) continue;
        const nextMask = mask | (1 << next);
        const candidate = dp[mask][current] + leg.durationMilliseconds;
        if (candidate < dp[nextMask][next]) {
          dp[nextMask][next] = candidate;
          previous[nextMask][next] = current;
        }
      }
    }
  }
  return { dp, previous, fullMask };
}

function unreachable(): never { throw new Error("일부 구간의 차량 경로가 없어 최적 경로를 계산할 수 없습니다."); }

export function optimizeClosedRoute(startId: string, waypointIds: string[], matrix: Matrix, fixedVisitOrders: FixedVisitOrder[] = []): RouteOptimizationResult {
  if (waypointIds.length === 0) return { orderedPlaceIds: [startId, startId], totalDurationMilliseconds: 0 };
  const { dp, previous, fullMask } = buildDp(startId, waypointIds, matrix, fixedVisitOrders);
  let best = INF; let end = -1;
  waypointIds.forEach((id, index) => {
    const back = costOf(matrix, id, startId);
    if (back && dp[fullMask][index] + back.durationMilliseconds < best) {
      best = dp[fullMask][index] + back.durationMilliseconds; end = index;
    }
  });
  if (end < 0) unreachable();
  return { orderedPlaceIds: [startId, ...restorePath(previous, fullMask, end).map((i) => waypointIds[i]), startId], totalDurationMilliseconds: best };
}

export function optimizeFixedDestinationRoute(startId: string, waypointIds: string[], destinationId: string, matrix: Matrix, fixedVisitOrders: FixedVisitOrder[] = []): RouteOptimizationResult {
  if (waypointIds.length === 0) {
    const direct = costOf(matrix, startId, destinationId);
    if (!direct) unreachable();
    return { orderedPlaceIds: [startId, destinationId], totalDurationMilliseconds: direct.durationMilliseconds };
  }
  const { dp, previous, fullMask } = buildDp(startId, waypointIds, matrix, fixedVisitOrders);
  let best = INF; let end = -1;
  waypointIds.forEach((id, index) => {
    const finalLeg = costOf(matrix, id, destinationId);
    if (finalLeg && dp[fullMask][index] + finalLeg.durationMilliseconds < best) {
      best = dp[fullMask][index] + finalLeg.durationMilliseconds; end = index;
    }
  });
  if (end < 0) unreachable();
  return { orderedPlaceIds: [startId, ...restorePath(previous, fullMask, end).map((i) => waypointIds[i]), destinationId], totalDurationMilliseconds: best };
}

export function optimizeOpenRoute(startId: string, waypointIds: string[], matrix: Matrix, fixedVisitOrders: FixedVisitOrder[] = []): RouteOptimizationResult {
  if (waypointIds.length === 0) return { orderedPlaceIds: [startId], totalDurationMilliseconds: 0 };
  const { dp, previous, fullMask } = buildDp(startId, waypointIds, matrix, fixedVisitOrders);
  let best = INF; let end = -1;
  waypointIds.forEach((_, index) => { if (dp[fullMask][index] < best) { best = dp[fullMask][index]; end = index; } });
  if (end < 0) unreachable();
  return { orderedPlaceIds: [startId, ...restorePath(previous, fullMask, end).map((i) => waypointIds[i])], totalDurationMilliseconds: best };
}

export class BitmaskDpOptimizer implements RouteOptimizer {
  optimize(input: RouteOptimizationInput): RouteOptimizationResult {
    const matrix = toCostMatrix(input.costs);
    const waypointIds = input.waypoints.map((place) => place.id);
    const fixedVisitOrders = input.fixedVisitOrders ?? [];
    if (input.returnToStart) return optimizeClosedRoute(input.start.id, waypointIds, matrix, fixedVisitOrders);
    if (input.destination) return optimizeFixedDestinationRoute(input.start.id, waypointIds, input.destination.id, matrix, fixedVisitOrders);
    return optimizeOpenRoute(input.start.id, waypointIds, matrix, fixedVisitOrders);
  }
}