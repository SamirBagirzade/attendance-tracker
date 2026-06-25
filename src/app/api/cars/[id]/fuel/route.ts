import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const carId = parseInt(id, 10);
  if (isNaN(carId)) return Response.json({ error: "Invalid car id." }, { status: 400 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const car = await prisma.car.findUnique({ where: { id: carId }, select: { fuelCardNumber: true } });

  const transactions = await prisma.fuelTransaction.findMany({
    where: {
      carId,
      ...(from || to
        ? {
            transactionTime: {
              ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
              ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    orderBy: { transactionTime: "desc" },
  });

  const totals = transactions.reduce(
    (acc, tx) => ({
      amount: acc.amount + tx.amount,
      quantity: acc.quantity + (tx.productQuantity ?? 0),
    }),
    { amount: 0, quantity: 0 },
  );

  return Response.json({ transactions, totals, fuelCardNumber: car?.fuelCardNumber ?? null });
}
