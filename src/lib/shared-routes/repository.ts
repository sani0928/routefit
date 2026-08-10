import { and, eq, isNotNull, lte } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { sharedRoutes } from "@/lib/db/schema";
import type { SharedRouteRecord, SharedRouteSnapshot, SharedRouteState } from "@/features/shared-routes/types";

const SHARE_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHARE_ID_LENGTH = 12;
const SHARE_DURATION_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;
const SHARE_ID_UNIQUE_INDEX = "shared_route_share_id_idx";
const ACTIVE_FINGERPRINT_UNIQUE_INDEX = "shared_route_active_snapshot_fingerprint_idx";

function createShareId() {
  const bytes = randomBytes(SHARE_ID_LENGTH);
  return Array.from(bytes, (byte) => SHARE_ID_ALPHABET[byte % SHARE_ID_ALPHABET.length]).join("");
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function createSnapshotFingerprint(snapshot: SharedRouteSnapshot) {
  return createHash("sha256").update(stableSerialize(snapshot)).digest("hex");
}

function isUniqueConstraintError(error: unknown, constraint: string) {
  const databaseError = error as { code?: string; constraint?: string; message?: string };
  return databaseError.code === "23505"
    && (databaseError.constraint === constraint || databaseError.message?.includes(constraint));
}

function asRecord(row: typeof sharedRoutes.$inferSelect): SharedRouteRecord {
  return {
    id: row.id,
    shareId: row.shareId,
    state: row.state as SharedRouteState,
    snapshot: row.snapshot,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    purgedAt: row.purgedAt,
  };
}

export async function createSharedRoute(snapshot: SharedRouteSnapshot) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SHARE_DURATION_MILLISECONDS);
  const snapshotFingerprint = createSnapshotFingerprint(snapshot);

  // Railway Cron 실행 전에도 만료된 동일 링크가 새 생성을 막지 않도록 즉시 정리한다.
  await db.update(sharedRoutes)
    .set({ state: "expired", snapshot: null, purgedAt: createdAt })
    .where(and(
      eq(sharedRoutes.snapshotFingerprint, snapshotFingerprint),
      eq(sharedRoutes.state, "active"),
      lte(sharedRoutes.expiresAt, createdAt),
    ));

  const activeRows = await db.select().from(sharedRoutes).where(and(
    eq(sharedRoutes.snapshotFingerprint, snapshotFingerprint),
    eq(sharedRoutes.state, "active"),
  )).limit(1);
  if (activeRows[0]) return { sharedRoute: asRecord(activeRows[0]), reused: true };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareId = createShareId();
    try {
      const rows = await db.insert(sharedRoutes).values({
        id: randomUUID(),
        shareId,
        snapshotFingerprint,
        state: "active",
        snapshot,
        createdAt,
        expiresAt,
      }).returning();
      return { sharedRoute: asRecord(rows[0]), reused: false };
    } catch (error) {
      if (isUniqueConstraintError(error, ACTIVE_FINGERPRINT_UNIQUE_INDEX)) {
        const existingRows = await db.select().from(sharedRoutes).where(and(
          eq(sharedRoutes.snapshotFingerprint, snapshotFingerprint),
          eq(sharedRoutes.state, "active"),
        )).limit(1);
        if (existingRows[0]) return { sharedRoute: asRecord(existingRows[0]), reused: true };
      }

      // 12자리 난수 충돌일 때만 다음 ID를 시도하고, 다른 DB 오류는 즉시 전파한다.
      if (attempt === 4 || !isUniqueConstraintError(error, SHARE_ID_UNIQUE_INDEX)) throw error;
    }
  }

  throw new Error("공유 링크를 만들지 못했습니다.");
}

export async function getSharedRoute(shareId: string) {
  const rows = await db.select().from(sharedRoutes).where(eq(sharedRoutes.shareId, shareId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const record = asRecord(row);
  if (record.state === "expired" || record.expiresAt <= new Date() || !record.snapshot) {
    return { ...record, state: "expired" as const, snapshot: null };
  }
  return record;
}

export async function expireSharedRoutes(now = new Date()) {
  const expired = await db.update(sharedRoutes)
    .set({ state: "expired", snapshot: null, purgedAt: now })
    .where(and(lte(sharedRoutes.expiresAt, now), eq(sharedRoutes.state, "active"), isNotNull(sharedRoutes.snapshot)))
    .returning({ id: sharedRoutes.id });
  return expired.length;
}
