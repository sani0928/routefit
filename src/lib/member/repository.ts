import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberWorkspaces, placeLists, routePlanPlaces, routePlans, savedPlaces } from "@/lib/db/schema";
import type { FixedVisitOrder, Place } from "@/features/route-optimization/types/route.types";
import type { MemberPlaceList, MemberRoutePlan, MemberWorkspace, SavedPlace } from "@/features/member/types";

const id = () => crypto.randomUUID();
const asNumber = (value: string) => Number(value);

function toPlace(row: typeof routePlanPlaces.$inferSelect): Place {
  return { id: row.id, name: row.name, address: row.address ?? undefined, latitude: asNumber(row.latitude), longitude: asNumber(row.longitude), type: "WAYPOINT", stayDurationMinutes: row.stayDurationMinutes };
}

export async function createDefaultFavoriteList(userId: string) {
  const existing = await db.select({ id: placeLists.id }).from(placeLists).where(eq(placeLists.userId, userId)).limit(1);
  if (existing.length) return;
  await db.insert(placeLists).values({ id: id(), userId, name: "즐겨찾기", color: "#2563eb" });
}

export async function getRoutePlans(userId: string): Promise<MemberRoutePlan[]> {
  const plans = await db.select().from(routePlans).where(eq(routePlans.userId, userId)).orderBy(desc(routePlans.isActive), desc(routePlans.updatedAt));
  const rows = await db.select().from(routePlanPlaces).innerJoin(routePlans, eq(routePlanPlaces.routePlanId, routePlans.id)).where(eq(routePlans.userId, userId)).orderBy(asc(routePlanPlaces.position));
  const byPlan = new Map<string, typeof routePlanPlaces.$inferSelect[]>();
  rows.forEach(({ route_plan_place }) => {
    const values = byPlan.get(route_plan_place.routePlanId) ?? [];
    values.push(route_plan_place); byPlan.set(route_plan_place.routePlanId, values);
  });
  return plans.map((plan) => {
    const planPlaces = byPlan.get(plan.id) ?? [];
    const places = planPlaces.map(toPlace).map((place, index): Place => ({ ...place, type: index === 0 ? "START" : "WAYPOINT" }));
    const fixedVisitOrders: FixedVisitOrder[] = planPlaces.flatMap((place, index) => place.isOrderLocked ? [{ placeId: place.id, visitOrder: index + 1 }] : []);
    return { id: plan.id, name: plan.name, returnToStart: plan.returnToStart, isActive: plan.isActive, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(), places, fixedVisitOrders };
  });
}

export async function getPlaceLists(userId: string): Promise<MemberPlaceList[]> {
  const rows = await db.select({ list: placeLists, count: sql<number>`count(${savedPlaces.id})::int` }).from(placeLists).leftJoin(savedPlaces, eq(savedPlaces.placeListId, placeLists.id)).where(eq(placeLists.userId, userId)).groupBy(placeLists.id).orderBy(desc(placeLists.updatedAt));
  return rows.map(({ list, count }) => ({ id: list.id, name: list.name, color: list.color as MemberPlaceList["color"], createdAt: list.createdAt.toISOString(), updatedAt: list.updatedAt.toISOString(), placeCount: count }));
}

export async function getSavedPlaces(userId: string, listId: string): Promise<SavedPlace[] | null> {
  const owned = await db.select({ id: placeLists.id }).from(placeLists).where(and(eq(placeLists.id, listId), eq(placeLists.userId, userId))).limit(1);
  if (!owned[0]) return null;
  const rows = await db.select().from(savedPlaces).where(eq(savedPlaces.placeListId, listId)).orderBy(desc(savedPlaces.updatedAt));
  return rows.map((row) => ({ id: row.id, placeListId: row.placeListId, name: row.name, address: row.address ?? undefined, latitude: asNumber(row.latitude), longitude: asNumber(row.longitude), createdAt: row.createdAt.toISOString() }));
}

export async function createRoutePlan(userId: string, name: string, copyFrom?: MemberRoutePlan): Promise<MemberRoutePlan> {
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(routePlans).where(eq(routePlans.userId, userId));
  if ((count[0]?.count ?? 0) >= 50) throw new Error("저장 동선은 최대 50개까지 만들 수 있습니다.");
  const planId = id();
  await db.transaction(async (tx) => {
    await tx.update(routePlans).set({ isActive: false, updatedAt: new Date() }).where(eq(routePlans.userId, userId));
    await tx.insert(routePlans).values({ id: planId, userId, name: name.trim() || "새 동선", returnToStart: copyFrom?.returnToStart ?? true, isActive: true });
    if (copyFrom?.places.length) await tx.insert(routePlanPlaces).values(copyFrom.places.map((place, index) => ({ id: id(), routePlanId: planId, position: index, name: place.name, address: place.address, latitude: String(place.latitude), longitude: String(place.longitude), stayDurationMinutes: place.stayDurationMinutes ?? 0, isOrderLocked: copyFrom.fixedVisitOrders.some((fixed) => fixed.placeId === place.id) })));
  });
  return (await getRoutePlans(userId)).find((plan) => plan.id === planId)!;
}

export async function setActiveRoutePlan(userId: string, planId: string) {
  const plan = await db.select({ id: routePlans.id }).from(routePlans).where(and(eq(routePlans.userId, userId), eq(routePlans.id, planId))).limit(1);
  if (!plan[0]) return false;
  await db.transaction(async (tx) => { await tx.update(routePlans).set({ isActive: false }).where(eq(routePlans.userId, userId)); await tx.update(routePlans).set({ isActive: true, updatedAt: new Date() }).where(eq(routePlans.id, planId)); });
  return true;
}

export async function saveRoutePlan(userId: string, planId: string, input: { name?: string; returnToStart: boolean; places: Place[]; fixedVisitOrders: FixedVisitOrder[] }) {
  const plan = await db.select().from(routePlans).where(and(eq(routePlans.id, planId), eq(routePlans.userId, userId))).limit(1);
  if (!plan[0]) return null;
  if (input.places.length > 15) throw new Error("방문 예정 장소는 최대 15곳까지 저장할 수 있습니다.");
  const lockedIds = new Set(input.fixedVisitOrders.map((fixed) => fixed.placeId));
  await db.transaction(async (tx) => {
    await tx.update(routePlans).set({ name: input.name?.trim() || plan[0].name, returnToStart: input.returnToStart, updatedAt: new Date() }).where(eq(routePlans.id, planId));
    await tx.delete(routePlanPlaces).where(eq(routePlanPlaces.routePlanId, planId));
    if (input.places.length) await tx.insert(routePlanPlaces).values(input.places.map((place, position) => ({ id: place.id, routePlanId: planId, position, name: place.name, address: place.address, latitude: String(place.latitude), longitude: String(place.longitude), stayDurationMinutes: position === 0 || (!input.returnToStart && position === input.places.length - 1) ? 0 : Math.max(0, place.stayDurationMinutes ?? 0), isOrderLocked: lockedIds.has(place.id) })));
  });
  return (await getRoutePlans(userId)).find((item) => item.id === planId) ?? null;
}

export async function updateRoutePlanMeta(userId: string, planId: string, input: { name?: string; isActive?: boolean }) {
  if (input.isActive) await setActiveRoutePlan(userId, planId);
  const updated = await db.update(routePlans).set({ ...(input.name ? { name: input.name.trim() } : {}), updatedAt: new Date() }).where(and(eq(routePlans.id, planId), eq(routePlans.userId, userId))).returning();
  return updated[0] ?? null;
}

export async function deleteRoutePlan(userId: string, planId: string) {
  const existing = await db.select().from(routePlans).where(and(eq(routePlans.id, planId), eq(routePlans.userId, userId))).limit(1);
  if (!existing[0]) return false;
  await db.delete(routePlans).where(eq(routePlans.id, planId));
  if (existing[0].isActive) {
    const next = await db.select().from(routePlans).where(eq(routePlans.userId, userId)).orderBy(desc(routePlans.updatedAt)).limit(1);
    if (next[0]) await setActiveRoutePlan(userId, next[0].id);
  }
  return true;
}
export async function createPlaceList(userId: string, name: string, color: string): Promise<MemberPlaceList> {
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(placeLists).where(eq(placeLists.userId, userId));
  if ((count[0]?.count ?? 0) >= 50) throw new Error("A user can create up to 50 place lists.");
  const createdAt = new Date();
  const list = { id: id(), userId, name: name.trim() || "New list", color, createdAt, updatedAt: createdAt };
  await db.insert(placeLists).values(list);
  return { id: list.id, name: list.name, color: list.color as MemberPlaceList["color"], createdAt: createdAt.toISOString(), updatedAt: createdAt.toISOString(), placeCount: 0 };
}

export async function updatePlaceList(userId: string, listId: string, input: { name?: string; color?: string }) {
  const updated = await db.update(placeLists).set({ ...(input.name ? { name: input.name.trim() } : {}), ...(input.color ? { color: input.color } : {}), updatedAt: new Date() }).where(and(eq(placeLists.id, listId), eq(placeLists.userId, userId))).returning();
  return updated[0] ?? null;
}

export async function deletePlaceList(userId: string, listId: string) {
  const deleted = await db.delete(placeLists).where(and(eq(placeLists.id, listId), eq(placeLists.userId, userId))).returning({ id: placeLists.id });
  return Boolean(deleted[0]);
}

export async function addSavedPlace(userId: string, listId: string, place: Omit<Place, "id" | "type">) {
  const owned = await db.select({ id: placeLists.id }).from(placeLists).where(and(eq(placeLists.id, listId), eq(placeLists.userId, userId))).limit(1);
  if (!owned[0]) return null;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(savedPlaces).where(eq(savedPlaces.placeListId, listId));
  if ((count[0]?.count ?? 0) >= 100) throw new Error("리스트별 장소는 최대 100개까지 저장할 수 있습니다.");
  const existing = await db.select({ id: savedPlaces.id }).from(savedPlaces).where(and(eq(savedPlaces.placeListId, listId), eq(savedPlaces.name, place.name), eq(savedPlaces.latitude, String(place.latitude)), eq(savedPlaces.longitude, String(place.longitude)))).limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };
  const placeId = id();
  await db.transaction(async (tx) => { await tx.insert(savedPlaces).values({ id: placeId, placeListId: listId, name: place.name, address: place.address, latitude: String(place.latitude), longitude: String(place.longitude) }); await tx.update(placeLists).set({ updatedAt: new Date() }).where(eq(placeLists.id, listId)); });
  return { id: placeId, created: true };
}

export async function deleteSavedPlace(userId: string, listId: string, placeId: string) {
  const owned = await db.select({ id: placeLists.id }).from(placeLists).where(and(eq(placeLists.id, listId), eq(placeLists.userId, userId))).limit(1);
  if (!owned[0]) return false;
  const deleted = await db.delete(savedPlaces).where(and(eq(savedPlaces.id, placeId), eq(savedPlaces.placeListId, listId))).returning({ id: savedPlaces.id });
  return Boolean(deleted[0]);
}

export async function getMemberWorkspace(userId: string): Promise<MemberWorkspace | null> {
  const rows = await db.select().from(memberWorkspaces).where(eq(memberWorkspaces.userId, userId)).limit(1);
  const workspace = rows[0];
  if (!workspace) return null;
  return {
    returnToStart: workspace.returnToStart,
    places: workspace.places,
    fixedVisitOrders: workspace.fixedVisitOrders,
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export async function saveMemberWorkspace(
  userId: string,
  input: Pick<MemberWorkspace, "returnToStart" | "places" | "fixedVisitOrders">,
): Promise<MemberWorkspace> {
  const updatedAt = new Date();
  const rows = await db.insert(memberWorkspaces)
    .values({ userId, ...input, updatedAt })
    .onConflictDoUpdate({
      target: memberWorkspaces.userId,
      set: { ...input, updatedAt },
    })
    .returning();
  const workspace = rows[0]!;
  return {
    returnToStart: workspace.returnToStart,
    places: workspace.places,
    fixedVisitOrders: workspace.fixedVisitOrders,
    updatedAt: workspace.updatedAt.toISOString(),
  };
}