import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { AppError, apiError } from "@/lib/errors";
import { incrementRateLimit } from "@/lib/cache/route-cache";
import { createSharedRoute } from "@/lib/shared-routes/repository";
import { sanitizeSharedRouteSnapshot, type SharedRouteSnapshot } from "@/features/shared-routes/types";
import { sharedRouteCreateSchema } from "@/lib/validation/shared-route.schema";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000;
const RATE_LIMIT_MAXIMUM = 10;
const globalForSharedRouteRateLimit = globalThis as typeof globalThis & {
  routeFitSharedRouteRateLimits?: Map<string, { count: number; resetAt: number }>;
};
const rateLimits = globalForSharedRouteRateLimit.routeFitSharedRouteRateLimits ??= new Map();

function clientIp(request: NextRequest) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

async function assertRateLimit(request: NextRequest) {
  const now = Date.now();
  const key = clientIp(request);
  const redisCount = await incrementRateLimit(`routefit:shared-route:create:${createHash("sha256").update(key).digest("hex")}`, RATE_LIMIT_WINDOW_MS / 1_000);
  if (redisCount !== undefined) {
    if (redisCount > RATE_LIMIT_MAXIMUM) throw new AppError("공유 링크는 잠시 후 다시 만들어 주세요.", 429, "SHARED_ROUTE_RATE_LIMIT");
    return;
  }
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (current.count >= RATE_LIMIT_MAXIMUM) throw new AppError("공유 링크는 잠시 후 다시 만들어 주세요.", 429, "SHARED_ROUTE_RATE_LIMIT");
  current.count += 1;
}

export async function POST(request: NextRequest) {
  try {
    await assertRateLimit(request);
    const input = sharedRouteCreateSchema.parse(await request.json()) as SharedRouteSnapshot;
    const { sharedRoute, reused } = await createSharedRoute(sanitizeSharedRouteSnapshot(input));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.routefit.co.kr";
    return NextResponse.json({
      shareId: sharedRoute.shareId,
      url: `${baseUrl}/share/${sharedRoute.shareId}`,
      expiresAt: sharedRoute.expiresAt.toISOString(),
      reused,
    }, { status: reused ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}
