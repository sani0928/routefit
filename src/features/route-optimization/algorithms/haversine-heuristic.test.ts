import { describe, expect, it } from "vitest";
import { haversineMeters, optimizeHaversineRoute } from "./haversine-heuristic";
import type { Place } from "../types/route.types";

const place = (id: string, latitude: number, longitude: number): Place => ({ id, name: id, latitude, longitude, type: id === "start" ? "START" : "WAYPOINT" });

describe("haversine heuristic", () => {
  it("orders nearby waypoints without route-cost API data", () => {
    const start = place("start", 37, 127);
    const near = place("near", 37.001, 127);
    const far = place("far", 37.01, 127);

    const result = optimizeHaversineRoute({ start, waypoints: [far, near], returnToStart: false });

    expect(result.orderedPlaceIds).toEqual(["start", "near", "far"]);
    expect(haversineMeters(start, near)).toBeLessThan(haversineMeters(start, far));
  });

  it("keeps a fixed waypoint at its requested visit order", () => {
    const start = place("start", 37, 127);
    const near = place("near", 37.001, 127);
    const far = place("far", 37.01, 127);

    const result = optimizeHaversineRoute({ start, waypoints: [near, far], returnToStart: false, fixedVisitOrders: [{ placeId: "far", visitOrder: 2 }] });

    expect(result.orderedPlaceIds).toEqual(["start", "far", "near"]);
  });
});
