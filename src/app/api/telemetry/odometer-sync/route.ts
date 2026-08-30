import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { syncOdometers, ODOMETER_SYNC_LAST_RUN } from "@/lib/wialon-odometer-sync";
import { SyncBusyError, readSyncTimestamp } from "@/lib/sync-lock";

export const runtime = "nodejs";

// Deliberately not under /api/cars: that segment has a [id] dynamic route, and a
// static sibling silently shadowing it is a trap for whoever reads this next.
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
  }

  try {
    const result = await syncOdometers();

    const refused = result.outcomes.filter((o) => o.status === "implausible");
    if (refused.length > 0) {
      console.error("[odometer-sync] Refused implausible readings:", refused);
    }

    return Response.json(result);
  } catch (err) {
    if (err instanceof SyncBusyError) {
      return Response.json({ error: "An odometer sync is already running." }, { status: 409 });
    }

    console.error("[odometer-sync] Sync failed:", err);
    return Response.json({ error: "Odometer sync failed. Check server logs." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const lastRun = await readSyncTimestamp(ODOMETER_SYNC_LAST_RUN);

  return Response.json({ lastRun: lastRun?.toISOString() ?? null });
}
