import { z } from "zod";

const coordinate = z.tuple([z.number().finite(), z.number().finite()]);
const place = z.object({
  id: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(300).optional(),
  latitude: z.number().finite().gte(-90).lte(90),
  longitude: z.number().finite().gte(-180).lte(180),
  type: z.enum(["START", "WAYPOINT", "DESTINATION"]),
  stayDurationMinutes: z.number().int().min(0).max(1_440).optional(),
  isCurrentLocation: z.boolean().optional(),
});
const trafficSection = z.object({
  pointIndex: z.number().int().min(0),
  pointCount: z.number().int().min(0),
  distanceMeters: z.number().min(0),
  congestion: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  speedKph: z.number().min(0).optional(),
});
const segment = z.object({
  fromId: z.string().min(1).max(128),
  toId: z.string().min(1).max(128),
  distanceMeters: z.number().min(0),
  durationMilliseconds: z.number().min(0),
  tollFare: z.number().min(0).optional(),
  path: z.array(coordinate).min(2).max(10_000),
  trafficSections: z.array(trafficSection).max(10_000),
});

export const sharedRouteCreateSchema = z.object({
  version: z.literal(1),
  returnToStart: z.boolean(),
  result: z.object({
    orderedPlaces: z.array(place).min(2).max(16),
    segments: z.array(segment).min(1).max(16),
    summary: z.object({
      totalDistanceMeters: z.number().min(0),
      totalDurationMilliseconds: z.number().min(0),
      totalTollFare: z.number().min(0),
      totalStayDurationMinutes: z.number().int().min(0).max(21_600),
      calculatedAt: z.string().datetime(),
      calculationDurationMilliseconds: z.number().min(0),
      optimizationMethod: z.literal("HAVERSINE_SINGLE"),
    }),
    path: z.array(coordinate).min(2).max(100_000),
  }),
});
