import type { RouteSegment } from "@/features/route-optimization/types/route.types";
import Redis from "ioredis";

const configuredTtlSeconds = Number(process.env.ROUTE_CACHE_TTL_SECONDS ?? 600);
const ttlSeconds = Number.isFinite(configuredTtlSeconds) ? Math.max(30, configuredTtlSeconds) : 600;
const redisUrl = process.env.REDIS_URL;
let redisUnavailableLogged = false;

declare global {
  var routeFitRedis: Redis | undefined;
}

function getRedisClient(): Redis | null {
  if (!redisUrl) {
    if (!redisUnavailableLogged) {
      console.warn("[RouteFit] REDIS_URL is not configured; route caching is disabled.");
      redisUnavailableLogged = true;
    }
    return null;
  }

  if (!globalThis.routeFitRedis) {
    globalThis.routeFitRedis = new Redis(redisUrl, {
      connectTimeout: 1_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    globalThis.routeFitRedis.on("error", () => {
      if (!redisUnavailableLogged) {
        console.warn("[RouteFit] Redis is unavailable; route caching is temporarily bypassed.");
        redisUnavailableLogged = true;
      }
    });
  }
  return globalThis.routeFitRedis;
}

async function withRedis<T>(operation: (client: Redis) => Promise<T>): Promise<T | undefined> {
  const client = getRedisClient();
  if (!client) return undefined;
  try {
    if (client.status === "wait") await client.connect();
    return await operation(client);
  } catch {
    if (!redisUnavailableLogged) {
      console.warn("[RouteFit] Redis request failed; route caching is temporarily bypassed.");
      redisUnavailableLogged = true;
    }
    return undefined;
  }
}

export function routeCacheKey(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): string {
  const point = (p: { latitude: number; longitude: number }) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
  return `routefit:directions:v1:traoptimal:${point(from)}:${point(to)}`;
}

export async function getCachedRoute(key: string): Promise<RouteSegment | undefined> {
  const raw = await withRedis((client) => client.get(key));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as RouteSegment;
  } catch {
    return undefined;
  }
}

export async function setCachedRoute(key: string, value: RouteSegment): Promise<void> {
  await withRedis((client) => client.set(key, JSON.stringify(value), "EX", ttlSeconds));
}

/** Returns undefined only when the shared Redis cache cannot be used. */
export async function incrementRateLimit(key: string, windowSeconds: number): Promise<number | undefined> {
  return withRedis(async (client) => {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    return count;
  });
}
