import { prisma } from "@/lib/prisma";

/**
 * Cross-process lock for background syncs, stored as an AppSetting row.
 *
 * Deliberately not a Postgres advisory lock: those are session-scoped and
 * Prisma pools connections, so the unlock could land on a different session
 * than the one holding the lock and leave it stuck permanently. A row survives
 * that, and a lock left behind by a crashed process ages out.
 */
const LOCK_STALE_MS = 30 * 60 * 1000;

export class SyncBusyError extends Error {
  constructor(what: string) {
    super(`A ${what} is already running.`);
    this.name = "SyncBusyError";
  }
}

async function acquire(key: string): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS).toISOString();

  // Atomic: exactly one caller can win, because the conflicting UPDATE only
  // fires when the stored lock has already gone stale.
  const rows = await prisma.$queryRaw<Array<{ key: string }>>`
    INSERT INTO "AppSetting" ("key", "value", "updatedAt")
    VALUES (${key}, ${now.toISOString()}, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = ${now.toISOString()}, "updatedAt" = now()
      WHERE "AppSetting"."value" < ${staleBefore}
    RETURNING "key"
  `;

  return rows.length > 0;
}

async function release(key: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}

/** Run `fn` while holding `key`, or throw SyncBusyError if someone else holds it. */
export async function withSyncLock<T>(key: string, label: string, fn: () => Promise<T>): Promise<T> {
  if (!(await acquire(key))) {
    throw new SyncBusyError(label);
  }

  try {
    return await fn();
  } finally {
    await release(key);
  }
}

/** Timestamp helpers for "has this sync run recently" checks. */
export async function readSyncTimestamp(key: string): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });

  if (!row) return null;

  const parsed = new Date(row.value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function writeSyncTimestamp(key: string, value: Date): Promise<void> {
  const iso = value.toISOString();

  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: iso },
    update: { value: iso },
  });
}
