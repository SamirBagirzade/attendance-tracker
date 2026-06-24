import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { syncFuelTransactions } from "@/lib/azpetrol-sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
  }

  try {
    const result = await syncFuelTransactions();
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
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
