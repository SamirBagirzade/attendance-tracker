import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { syncFuelTransactions } from "@/lib/azpetrol-sync";
import { SyncBusyError } from "@/lib/sync-lock";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
  }

  try {
    const result = await syncFuelTransactions();

    if (result.partial) {
      console.error("[fuel-sync] PARTIAL — chunks failed, data has gaps:", result.failedChunks);
    }

    return Response.json(result);
  } catch (err) {
    if (err instanceof SyncBusyError) {
      return Response.json({ error: "A fuel sync is already running." }, { status: 409 });
    }

    // Don't hand the caller the raw error — Prisma and fetch errors carry table
    // names and upstream URLs.
    console.error("[fuel-sync] Sync failed:", err);
    return Response.json({ error: "Fuel sync failed. Check server logs." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { prisma } = await import("@/lib/prisma");
  const [count, latest] = await Promise.all([
    prisma.fuelTransaction.count(),
    prisma.fuelTransaction.aggregate({ _max: { transactionTime: true }, _min: { transactionTime: true } }),
  ]);

  return Response.json({
    total: count,
    earliest: latest._min.transactionTime,
    latest: latest._max.transactionTime,
  });
}
