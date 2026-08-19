export type PlaceType = "START" | "WAYPOINT" | "DESTINATION";

export interface Place {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  /** 검색 제공자가 부여한 장소 식별자. 카카오 장소 검색 결과에서만 제공된다. */
  providerId?: string;
  /** 현재 세션에서 확인한 장소 리스트 소속. 화면 보조 정보이며 경로 계산에는 사용하지 않는다. */
  savedListIds?: string[];
  type: PlaceType;
  stayDurationMinutes?: number;
  isCurrentLocation?: boolean;
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
  fixedVisitOrders?: FixedVisitOrder[];
}

export interface RouteOptimizationResult {
  orderedPlaceIds: string[];
  totalDurationMilliseconds: number;
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
  orderedPlaces: Pick<Place, "id" | "name" | "address" | "latitude" | "longitude" | "type" | "stayDurationMinutes" | "isCurrentLocation">[];
  segments: RouteSegment[];
  summary: {
    totalDistanceMeters: number;
    totalDurationMilliseconds: number;
    totalTollFare: number;
    totalStayDurationMinutes: number;
    calculatedAt: string;
    calculationDurationMilliseconds: number;
    optimizationMethod: "HAVERSINE_SINGLE";
  };
  path: [number, number][];
}
