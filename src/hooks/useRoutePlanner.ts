"use client";

import { useState } from "react";
import type { FixedVisitOrder, OptimizationResponse, Place } from "@/features/route-optimization/types/route.types";

export type RoutePlannerStatus = "IDLE" | "BUILDING_MATRIX" | "OPTIMIZING" | "FETCHING_FINAL_ROUTE" | "SUCCESS" | "ERROR";
export type RouteResultSnapshot = { returnToStart: boolean; fixedVisitOrders: FixedVisitOrder[] };

export function useRoutePlanner() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [returnToStart, setReturnToStart] = useState(true);
  const [fixedVisitOrders, setFixedVisitOrders] = useState<FixedVisitOrder[]>([]);
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [resultSnapshot, setResultSnapshot] = useState<RouteResultSnapshot | null>(null);
  const [routeNeedsRecalculation, setRouteNeedsRecalculation] = useState(false);
  const [status, setStatus] = useState<RoutePlannerStatus>("IDLE");
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);

  return { places, setPlaces, returnToStart, setReturnToStart, fixedVisitOrders, setFixedVisitOrders, result, setResult, resultSnapshot, setResultSnapshot, routeNeedsRecalculation, setRouteNeedsRecalculation, status, setStatus, hoveredSegmentIndex, setHoveredSegmentIndex, selectedSegmentIndex, setSelectedSegmentIndex };
}
