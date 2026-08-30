import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Durable limiter, backed by the RateLimit table.
 *
 * Used for login: an in-memory counter resets on every restart, and since a
 * deploy is a restart, an attacker only has to wait for one to get a fresh
 * quota. This survives that, and survives running more than one worker.
 *
 * The whole check is a single atomic statement. INSERT starts a window;
 * ON CONFLICT either resets it (the stored window has expired) or increments
 * within it, so two simultaneous requests can never both read a stale count.
 */
export async function checkDurableLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStartsAfter = new Date(now.getTime() - windowMs);

  const [row] = await prisma.$queryRaw<Array<{ count: number; windowStart: Date }>>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "updatedAt")
    VALUES (${key}, 1, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE
      SET "count" = CASE
            WHEN "RateLimit"."windowStart" <= ${windowStartsAfter} THEN 1
            ELSE "RateLimit"."count" + 1
          END,
          "windowStart" = CASE
            WHEN "RateLimit"."windowStart" <= ${windowStartsAfter} THEN ${now}
            ELSE "RateLimit"."windowStart"
          END,
          "updatedAt" = ${now}
    RETURNING "count", "windowStart"
  `;

  const elapsed = now.getTime() - row.windowStart.getTime();

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)),
  };
}

/** Clear a key's counter — call after a successful login so one bad typo run doesn't linger. */
export async function clearDurableLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/**
 * Process-local limiter for cost control rather than security.
 *
 * Used for chat: the thing being protected is the Anthropic bill, not an
 * account, so losing counters on restart is acceptable and a database write per
 * message is not worth it.
 */
const memoryBuckets = new Map<string, { count: number; windowStart: number }>();

export function checkMemoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    memoryBuckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - bucket.windowStart)) / 1000)),
  };
}

// Buckets are only read while their window is live, so anything older is dead
// weight. Swept opportunistically rather than on a timer, which would keep a
// handle alive and interfere with a clean shutdown.
let lastSweep = Date.now();

export function sweepMemoryLimits(maxAgeMs: number): void {
  const now = Date.now();

  if (now - lastSweep < maxAgeMs) return;

  lastSweep = now;

  for (const [key, bucket] of memoryBuckets) {
    if (now - bucket.windowStart >= maxAgeMs) {
      memoryBuckets.delete(key);
    }
  }
}

/**
 * Best-effort client address. There is no reverse proxy in front of this app
 * today, so x-forwarded-for is only trusted as a fallback — if one is added,
 * it must be configured to overwrite rather than append the header, or a client
 * can spoof its own address here.
 */
export function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
