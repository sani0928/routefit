export type PlaceType = "START" | "WAYPOINT" | "DESTINATION";

export interface Place {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  type: PlaceType;
  stayDurationMinutes?: number;
}

export interface FixedVisitOrder {
  placeId: string;
  visitOrder: number;
}

export interface RouteCost {
  fromId: string;
  toId: string;
  distanceMeters: number;
  durationMilliseconds: number;
  tollFare?: number;
}

export interface RouteOptimizationInput {
  start: Place;
  waypoints: Place[];
  destination?: Place | null;
  returnToStart: boolean;
  costs: RouteCost[];
  fixedVisitOrders?: FixedVisitOrder[];
}

export interface RouteOptimizationResult {
  orderedPlaceIds: string[];
  totalDurationMilliseconds: number;
}

export interface RouteOptimizer {
  optimize(input: RouteOptimizationInput): RouteOptimizationResult;
}

export type TrafficCongestion = 0 | 1 | 2 | 3;

export interface RouteTrafficSection {
  pointIndex: number;
  pointCount: number;
  distanceMeters: number;
  congestion: TrafficCongestion;
  speedKph?: number;
}

export interface RouteSegment extends RouteCost {
  path: [number, number][];
  trafficSections: RouteTrafficSection[];
}

export interface OptimizationResponse {
  orderedPlaces: Pick<Place, "id" | "name" | "address" | "latitude" | "longitude" | "type" | "stayDurationMinutes">[];
  segments: RouteSegment[];
  summary: {
    totalDistanceMeters: number;
    totalDurationMilliseconds: number;
    totalTollFare: number;
    totalStayDurationMinutes: number;
    calculatedAt: string;
    calculationDurationMilliseconds: number;
  };
  path: [number, number][];
}