import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const transactions = await prisma.fuelTransaction.findMany({
    where: {
      carId: null,
      ...(from || to
        ? {
            transactionTime: {
              ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
              ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ plate: "asc" }, { transactionTime: "desc" }],
  });

  // Group by plate
  const byPlate = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const existing = byPlate.get(tx.plate) ?? [];
    existing.push(tx);
    byPlate.set(tx.plate, existing);
  }

  const groups = Array.from(byPlate.entries()).map(([plate, txs]) => ({
    plate,
    totalAmount: txs.reduce((s, t) => s + t.amount, 0),
    totalQuantity: txs.reduce((s, t) => s + (t.productQuantity ?? 0), 0),
    count: txs.length,
    transactions: txs,
  }));

  return Response.json({ groups, total: transactions.length });
}
