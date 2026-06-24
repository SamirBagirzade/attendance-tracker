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

  const where = {
    ...(from || to ? {
      transactionTime: {
        ...(from ? { gte: new Date(from + "T00:00:00") } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
      },
    } : {}),
  };

  const [transactions, cars] = await Promise.all([
    prisma.fuelTransaction.findMany({
      where,
      include: { car: { select: { makeModel: true, licensePlate: true } } },
      orderBy: { transactionTime: "asc" },
    }),
    prisma.car.findMany({ select: { id: true, makeModel: true, licensePlate: true } }),
  ]);

  // Summary
  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  const totalQuantity = transactions.reduce((s, t) => s + (t.productQuantity ?? 0), 0);
  const uniquePlates = new Set(transactions.map((t) => t.plate)).size;
  const uniqueStations = new Set(transactions.map((t) => t.stationName).filter(Boolean)).size;

  // By month
  const monthMap = new Map<string, { amount: number; quantity: number; fillUps: number }>();
  for (const tx of transactions) {
    const key = tx.transactionTime.toISOString().slice(0, 7);
    const existing = monthMap.get(key) ?? { amount: 0, quantity: 0, fillUps: 0 };
    existing.amount += tx.amount;
    existing.quantity += tx.productQuantity ?? 0;
    existing.fillUps++;
    monthMap.set(key, existing);
  }
  const byMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, ...d, amount: Math.round(d.amount * 100) / 100, quantity: Math.round(d.quantity * 100) / 100 }));

  // By product
  const productMap = new Map<string, { amount: number; quantity: number; fillUps: number }>();
  for (const tx of transactions) {
    const key = tx.productName ?? "Unknown";
    const existing = productMap.get(key) ?? { amount: 0, quantity: 0, fillUps: 0 };
    existing.amount += tx.amount;
    existing.quantity += tx.productQuantity ?? 0;
    existing.fillUps++;
    productMap.set(key, existing);
  }
  const byProduct = Array.from(productMap.entries())
    .map(([product, d]) => ({ product, ...d, amount: Math.round(d.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  // By car/plate
  const plateMap = new Map<string, { plate: string; carName: string | null; isExternal: boolean; amount: number; quantity: number; fillUps: number }>();
  for (const tx of transactions) {
    const existing = plateMap.get(tx.plate) ?? {
      plate: tx.plate,
      carName: tx.car ? `${tx.car.makeModel} (${tx.car.licensePlate})` : null,
      isExternal: tx.carId === null,
      amount: 0,
      quantity: 0,
      fillUps: 0,
    };
    existing.amount += tx.amount;
    existing.quantity += tx.productQuantity ?? 0;
    existing.fillUps++;
    plateMap.set(tx.plate, existing);
  }
  const byCar = Array.from(plateMap.values())
    .map((d) => ({ ...d, amount: Math.round(d.amount * 100) / 100, quantity: Math.round(d.quantity * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  // By station
  const stationMap = new Map<string, { amount: number; quantity: number; fillUps: number }>();
  for (const tx of transactions) {
    const key = tx.stationName ?? "Unknown";
    const existing = stationMap.get(key) ?? { amount: 0, quantity: 0, fillUps: 0 };
    existing.amount += tx.amount;
    existing.quantity += tx.productQuantity ?? 0;
    existing.fillUps++;
    stationMap.set(key, existing);
  }
  const byStation = Array.from(stationMap.entries())
    .map(([station, d]) => ({ station, ...d, amount: Math.round(d.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  // By card holder
  const holderMap = new Map<string, { amount: number; fillUps: number }>();
  for (const tx of transactions) {
    const key = (tx.cardHolderName ?? "Unknown").trim();
    const existing = holderMap.get(key) ?? { amount: 0, fillUps: 0 };
    existing.amount += tx.amount;
    existing.fillUps++;
    holderMap.set(key, existing);
  }
  const byCardHolder = Array.from(holderMap.entries())
    .map(([holder, d]) => ({ holder, ...d, amount: Math.round(d.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  return Response.json({
    summary: {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalQuantity: Math.round(totalQuantity * 100) / 100,
      totalFillUps: transactions.length,
      avgCostPerFill: transactions.length ? Math.round((totalAmount / transactions.length) * 100) / 100 : 0,
      avgQtyPerFill: transactions.length ? Math.round((totalQuantity / transactions.length) * 100) / 100 : 0,
      uniquePlates,
      uniqueStations,
    },
    byMonth,
    byProduct,
    byCar,
    byStation,
    byCardHolder,
  });
}
