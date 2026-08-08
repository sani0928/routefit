import { z } from "zod";

const coordinate = z.object({
  latitude: z.number().finite().min(33).max(39),
  longitude: z.number().finite().min(124).max(132),
});

export const placeSchema = coordinate.extend({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().max(300).optional(),
  type: z.enum(["START", "WAYPOINT", "DESTINATION"]).optional(),
  stayDurationMinutes: z.number().int().min(0).max(1_440).default(0),
});

const fixedVisitOrderSchema = z.object({
  placeId: z.string().min(1).max(100),
  visitOrder: z.number().int().min(2).max(15),
});

export const optimizeSchema = z.object({
  start: placeSchema,
  waypoints: z.array(placeSchema).max(14),
  destination: placeSchema.nullable().optional(),
  returnToStart: z.boolean(),
  fixedVisitOrders: z.array(fixedVisitOrderSchema).max(13).default([]),
  optimizationCriterion: z.literal("DURATION").default("DURATION"),
  routeOption: z.enum(["trafast", "traoptimal", "tracomfort"]).default("traoptimal"),
}).superRefine((input, ctx) => {
  if (input.returnToStart && input.destination) ctx.addIssue({ code: "custom", message: "출발지 복귀 시 별도 도착지를 지정할 수 없습니다.", path: ["destination"] });
  const all = [input.start, ...input.waypoints, ...(input.destination ? [input.destination] : [])];
  const ids = new Set<string>();
  const coords = new Set<string>();
  for (const place of all) {
    if (ids.has(place.id)) ctx.addIssue({ code: "custom", message: "중복된 장소 ID입니다." });
    ids.add(place.id);
    const key = `${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`;
    if (coords.has(key)) ctx.addIssue({ code: "custom", message: "동일한 장소는 중복 등록할 수 없습니다." });
    coords.add(key);
  }

  const waypointIds = new Set(input.waypoints.map((place) => place.id));
  const fixedPlaceIds = new Set<string>();
  const fixedOrders = new Set<number>();
  const lastWaypointOrder = input.waypoints.length + 1;
  for (const fixed of input.fixedVisitOrders) {
    if (!waypointIds.has(fixed.placeId)) ctx.addIssue({ code: "custom", message: "경유지만 방문 순서를 고정할 수 있습니다.", path: ["fixedVisitOrders"] });
    if (fixed.visitOrder > lastWaypointOrder) ctx.addIssue({ code: "custom", message: "고정 순서가 방문 가능한 범위를 벗어났습니다.", path: ["fixedVisitOrders"] });
    if (fixedPlaceIds.has(fixed.placeId)) ctx.addIssue({ code: "custom", message: "같은 장소의 순서를 중복 고정할 수 없습니다.", path: ["fixedVisitOrders"] });
    if (fixedOrders.has(fixed.visitOrder)) ctx.addIssue({ code: "custom", message: "같은 방문 순서에는 한 장소만 고정할 수 있습니다.", path: ["fixedVisitOrders"] });
    fixedPlaceIds.add(fixed.placeId);
    fixedOrders.add(fixed.visitOrder);
  }
});

export const routeCostSchema = z.object({ origin: coordinate, destination: coordinate });
export const geocodeQuerySchema = z.string().trim().min(2).max(200);
export const placeSearchSchema = z.object({
  query: geocodeQuerySchema,
  page: z.coerce.number().int().min(1).max(45).default(1),
  size: z.coerce.number().int().min(1).max(30).default(10),
  sort: z.enum(["accuracy", "distance"]).default("accuracy"),
  x: z.coerce.number().finite().min(124).max(132).optional(),
  y: z.coerce.number().finite().min(33).max(39).optional(),
}).superRefine((input, ctx) => {
  if (input.sort === "distance" && (input.x === undefined || input.y === undefined)) {
    ctx.addIssue({ code: "custom", message: "거리순 검색에는 기준 좌표가 필요합니다.", path: ["sort"] });
  }
});
