import { describe, expect, it } from "vitest";
import { BitmaskDpOptimizer } from "./bitmask-dp";
import type { Place, RouteCost } from "../types/route.types";

const start: Place = { id: "s", name: "출발", latitude: 37, longitude: 127, type: "START" };
const a: Place = { id: "a", name: "A", latitude: 37.1, longitude: 127.1, type: "WAYPOINT" };
const b: Place = { id: "b", name: "B", latitude: 37.2, longitude: 127.2, type: "WAYPOINT" };
const end: Place = { id: "e", name: "도착", latitude: 37.3, longitude: 127.3, type: "DESTINATION" };
function costs(rows: Array<[string, string, number]>): RouteCost[] { return rows.map(([fromId, toId, minutes]) => ({ fromId, toId, durationMilliseconds: minutes * 60_000, distanceMeters: minutes * 1000 })); }
const directed = costs([["s","a",2],["s","b",10],["s","e",9],["a","s",8],["a","b",1],["a","e",6],["b","s",3],["b","a",7],["b","e",2],["e","s",4],["e","a",9],["e","b",5]]);
const optimizer = new BitmaskDpOptimizer();

describe("BitmaskDpOptimizer", () => {
  it("uses a directed cost matrix and finds the exact closed route", () => {
    const result = optimizer.optimize({ start, waypoints: [a, b], returnToStart: true, costs: directed });
    expect(result.orderedPlaceIds).toEqual(["s", "a", "b", "s"]); expect(result.totalDurationMilliseconds).toBe(6 * 60_000);
  });
  it("ends at a fixed destination", () => {
    const result = optimizer.optimize({ start, waypoints: [a, b], destination: end, returnToStart: false, costs: directed });
    expect(result.orderedPlaceIds).toEqual(["s", "a", "b", "e"]); expect(result.totalDurationMilliseconds).toBe(5 * 60_000);
  });
  it("chooses the best free endpoint", () => {
    const result = optimizer.optimize({ start, waypoints: [a, b], returnToStart: false, costs: directed });
    expect(result.orderedPlaceIds).toEqual(["s", "a", "b"]); expect(result.totalDurationMilliseconds).toBe(3 * 60_000);
  });
  it("handles zero and one waypoint", () => {
    expect(optimizer.optimize({ start, waypoints: [], returnToStart: false, costs: [] }).orderedPlaceIds).toEqual(["s"]);
    expect(optimizer.optimize({ start, waypoints: [a], returnToStart: true, costs: directed }).orderedPlaceIds).toEqual(["s", "a", "s"]);
  });
  it("keeps a selected waypoint at its guaranteed visit order", () => {
    const result = optimizer.optimize({ start, waypoints: [a, b], destination: end, returnToStart: false, fixedVisitOrders: [{ placeId: "b", visitOrder: 2 }], costs: directed });
    expect(result.orderedPlaceIds).toEqual(["s", "b", "a", "e"]);
  });  it("fails clearly when a required leg is unreachable", () => {
    expect(() => optimizer.optimize({ start, waypoints: [a, b], returnToStart: true, costs: directed.filter((cost) => !(cost.toId === "s" && (cost.fromId === "a" || cost.fromId === "b"))) })).toThrow("차량 경로");
  });
});
