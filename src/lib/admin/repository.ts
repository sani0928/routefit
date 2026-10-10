import { and, count, desc, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiUsageByActorDaily, apiUsageDaily, sharedRoutes, users } from "@/lib/db/schema";

type DirectionsUsage = {
  userId?: string | null;
  routeCalculations?: number;
  externalDirectionsRequests?: number;
  cacheHits?: number;
  failedRequests?: number;
};

type UsageMetrics = Required<Omit<DirectionsUsage, "userId">>;
type UsageRow = UsageMetrics & { day: string; updatedAt: Date };

export type AdminUsagePeriod = "7d" | "30d" | "1y";

export const ADMIN_USAGE_PERIODS: Record<AdminUsagePeriod, { days: number; label: string }> = {
  "7d": { days: 7, label: "최근 7일" },
  "30d": { days: 30, label: "최근 한 달" },
  "1y": { days: 365, label: "최근 1년" },
};

export function isAdminUsagePeriod(value: string | undefined): value is AdminUsagePeriod {
  return value === "7d" || value === "30d" || value === "1y";
}

function koreanDay(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function dayBefore(day: string, days: number) {
  const value = new Date(`${day}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function shortDay(day: string) {
  return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
}

function totalUsage(rows: UsageMetrics[]): UsageMetrics {
  return rows.reduce((sum, usage) => ({
    routeCalculations: sum.routeCalculations + usage.routeCalculations,
    externalDirectionsRequests: sum.externalDirectionsRequests + usage.externalDirectionsRequests,
    cacheHits: sum.cacheHits + usage.cacheHits,
    failedRequests: sum.failedRequests + usage.failedRequests,
  }), { routeCalculations: 0, externalDirectionsRequests: 0, cacheHits: 0, failedRequests: 0 });
}

function buildUsageSeries(rows: UsageRow[], period: AdminUsagePeriod) {
  if (period === "7d") {
    return rows.map((usage) => ({ ...totalUsage([usage]), label: shortDay(usage.day) }));
  }

  if (period === "30d") {
    return Array.from({ length: 6 }, (_, index) => {
      const group = rows.slice(index * 5, index * 5 + 5);
      return {
        ...totalUsage(group),
        label: `${shortDay(group[0]!.day)}–${shortDay(group.at(-1)!.day)}`,
      };
    });
  }

  const monthlyGroups = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const month = row.day.slice(0, 7);
    monthlyGroups.set(month, [...(monthlyGroups.get(month) ?? []), row]);
  }
  return Array.from(monthlyGroups, ([month, group]) => ({
    ...totalUsage(group),
    label: `${Number(month.slice(5, 7))}월`,
  }));
}

export async function recordDirectionsUsage({
  userId = null,
  routeCalculations = 0,
  externalDirectionsRequests = 0,
  cacheHits = 0,
  failedRequests = 0,
}: DirectionsUsage) {
  if (routeCalculations === 0 && externalDirectionsRequests === 0 && cacheHits === 0 && failedRequests === 0) return;
  const updatedAt = new Date();
  const normalizedUserId = userId?.trim() || null;
  const actorKey = normalizedUserId ? `user:${normalizedUserId}` : "anonymous";
  const day = koreanDay(updatedAt);
  const usage = {
    routeCalculations,
    externalDirectionsRequests,
    cacheHits,
    failedRequests,
    updatedAt,
  };
  await db.transaction(async (tx) => {
    await tx.insert(apiUsageDaily).values({
      day,
      ...usage,
    }).onConflictDoUpdate({
      target: apiUsageDaily.day,
      set: {
        routeCalculations: sql`${apiUsageDaily.routeCalculations} + ${routeCalculations}`,
        externalDirectionsRequests: sql`${apiUsageDaily.externalDirectionsRequests} + ${externalDirectionsRequests}`,
        cacheHits: sql`${apiUsageDaily.cacheHits} + ${cacheHits}`,
        failedRequests: sql`${apiUsageDaily.failedRequests} + ${failedRequests}`,
        updatedAt,
      },
    });
    await tx.insert(apiUsageByActorDaily).values({
      day,
      actorKey,
      userId: normalizedUserId,
      ...usage,
    }).onConflictDoUpdate({
      target: [apiUsageByActorDaily.day, apiUsageByActorDaily.actorKey],
      set: {
        routeCalculations: sql`${apiUsageByActorDaily.routeCalculations} + ${routeCalculations}`,
        externalDirectionsRequests: sql`${apiUsageByActorDaily.externalDirectionsRequests} + ${externalDirectionsRequests}`,
        cacheHits: sql`${apiUsageByActorDaily.cacheHits} + ${cacheHits}`,
        failedRequests: sql`${apiUsageByActorDaily.failedRequests} + ${failedRequests}`,
        updatedAt,
      },
    });
  });
}

export async function getAdminDashboardData(period: AdminUsagePeriod, now = new Date()) {
  const today = koreanDay(now);
  const periodConfig = ADMIN_USAGE_PERIODS[period];
  const fromDay = dayBefore(today, periodConfig.days - 1);
  const [usageRows, activeShareCountResult, activeShares] = await Promise.all([
    db.select().from(apiUsageDaily).where(gte(apiUsageDaily.day, fromDay)).orderBy(apiUsageDaily.day),
    db.select({ count: count() }).from(sharedRoutes).where(and(eq(sharedRoutes.state, "active"), gt(sharedRoutes.expiresAt, now))),
    db.select({
      shareId: sharedRoutes.shareId,
      createdAt: sharedRoutes.createdAt,
      expiresAt: sharedRoutes.expiresAt,
      creatorEmail: users.email,
    }).from(sharedRoutes)
      .leftJoin(users, eq(sharedRoutes.createdByUserId, users.id))
      .where(and(eq(sharedRoutes.state, "active"), gt(sharedRoutes.expiresAt, now)))
      .orderBy(desc(sharedRoutes.createdAt))
      .limit(50),
  ]);

  const usageByDay = new Map(usageRows.map((row) => [row.day, row]));
  const periodUsage: UsageRow[] = Array.from({ length: periodConfig.days }, (_, index) => {
    const day = dayBefore(today, periodConfig.days - 1 - index);
    return usageByDay.get(day) ?? {
      day,
      routeCalculations: 0,
      externalDirectionsRequests: 0,
      cacheHits: 0,
      failedRequests: 0,
      updatedAt: now,
    };
  });
  const totals = totalUsage(periodUsage);

  const actorUsageRows = await db.select({
    actorKey: apiUsageByActorDaily.actorKey,
    userId: apiUsageByActorDaily.userId,
    userName: users.name,
    userEmail: users.email,
    routeCalculations: sql<number>`coalesce(sum(${apiUsageByActorDaily.routeCalculations}), 0)::integer`,
    externalDirectionsRequests: sql<number>`coalesce(sum(${apiUsageByActorDaily.externalDirectionsRequests}), 0)::integer`,
    cacheHits: sql<number>`coalesce(sum(${apiUsageByActorDaily.cacheHits}), 0)::integer`,
    failedRequests: sql<number>`coalesce(sum(${apiUsageByActorDaily.failedRequests}), 0)::integer`,
    lastUsedAt: sql<Date>`max(${apiUsageByActorDaily.updatedAt})`,
  }).from(apiUsageByActorDaily)
    .leftJoin(users, eq(apiUsageByActorDaily.userId, users.id))
    .where(gte(apiUsageByActorDaily.day, fromDay))
    .groupBy(apiUsageByActorDaily.actorKey, apiUsageByActorDaily.userId, users.name, users.email)
    .orderBy(desc(sql`sum(${apiUsageByActorDaily.externalDirectionsRequests})`), desc(sql`sum(${apiUsageByActorDaily.routeCalculations})`))
    .limit(50);

  return {
    today,
    fromDay,
    period,
    periodConfig,
    usageSeries: buildUsageSeries(periodUsage, period),
    totals,
    activeShareCount: activeShareCountResult[0]?.count ?? 0,
    activeShares,
    actorUsage: actorUsageRows,
  };
}
