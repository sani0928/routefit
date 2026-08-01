import type { RouteSegment } from "@/features/route-optimization/types/route.types";

type Entry = { expiresAt: number; value: RouteSegment };
const cache = new Map<string, Entry>();
const ttlMs = Math.max(300, Number(process.env.ROUTE_CACHE_TTL_SECONDS ?? 600)) * 1000;

export function routeCacheKey(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): string {
  const point = (p: { latitude: number; longitude: number }) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
  return `route:${point(from)}:${point(to)}:traoptimal`;
}

export function getCachedRoute(key: string): RouteSegment | undefined {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) { cache.delete(key); return undefined; }
  return hit.value;
}

export function setCachedRoute(key: string, value: RouteSegment): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
