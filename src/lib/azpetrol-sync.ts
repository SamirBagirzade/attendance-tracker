import { prisma } from "@/lib/prisma";
import { findTransactions } from "@/lib/azpetrol-client";
import { format, addMonths, startOfMonth, endOfMonth, subDays } from "date-fns";

export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s\-]/g, "").trim();
}

function buildChunks(from: Date, to: Date): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const monthEnd = endOfMonth(cursor);
    chunks.push({
      start: format(cursor, "yyyy-MM-dd"),
      end: format(monthEnd < to ? monthEnd : to, "yyyy-MM-dd"),
    });
    cursor = startOfMonth(addMonths(cursor, 1));
  }
  return chunks;
}

function txId(tx: Record<string, unknown>): string | null {
  const id = tx.id ?? tx.transactionId ?? tx.oid;
  if (!id) return null;
  return String(id);
}

export type SyncResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  fromDate: string;
  toDate: string;
  chunks: number;
};

export async function syncFuelTransactions(): Promise<SyncResult> {
  const toDate = new Date();

  // Find latest transaction already in DB — go back 1 day to catch stragglers
  const agg = await prisma.fuelTransaction.aggregate({ _max: { transactionTime: true } });
  const fromDate = agg._max.transactionTime
    ? subDays(agg._max.transactionTime, 1)
    : new Date("2026-01-01T00:00:00");

  if (fromDate > toDate) {
    return { fetched: 0, inserted: 0, skipped: 0, fromDate: format(fromDate, "yyyy-MM-dd"), toDate: format(toDate, "yyyy-MM-dd"), chunks: 0 };
  }

  // Build plate → carId map (normalized)
  const cars = await prisma.car.findMany({ select: { id: true, licensePlate: true } });
  const plateToCarId = new Map(cars.map((c) => [normalizePlate(c.licensePlate), c.id]));

  // Fetch all chunks
  const chunks = buildChunks(fromDate, toDate);
  const rawTransactions: Record<string, unknown>[] = [];

  for (const chunk of chunks) {
    try {
      const json = (await findTransactions({ StartDate: `${chunk.start}T00:00:00`, EndDate: `${chunk.end}T23:59:59` })) as Record<string, unknown>;
      if (json.isSuccess === false) continue;
      const data = json.data;
      if (Array.isArray(data)) {
        rawTransactions.push(...(data as Record<string, unknown>[]).filter((tx) => String(tx.transactionType) === "21"));
      }
    } catch {
      // Skip failed chunks — don't abort entire sync
    }
  }

  let inserted = 0;
  let skipped = 0;

  for (const tx of rawTransactions) {
    const id = txId(tx);
    if (!id) { skipped++; continue; }

    const rawPlate = String(tx.plate ?? "");
    const plate = normalizePlate(rawPlate);
    const carId = plateToCarId.get(plate) ?? null;

    let transactionTime: Date;
    try {
      transactionTime = new Date(String(tx.transactionTime ?? tx.transactionTimeStr ?? ""));
      if (isNaN(transactionTime.getTime())) throw new Error("invalid");
    } catch {
      skipped++;
      continue;
    }

    await prisma.fuelTransaction.upsert({
      where: { id },
      create: {
        id,
        transactionTime,
        cardHolderName: tx.cardHolderName ? String(tx.cardHolderName) : null,
        cardNumber: tx.cardNumber ? String(tx.cardNumber) : null,
        productName: tx.productName ? String(tx.productName) : null,
        productQuantity: tx.productQuantity != null ? Number(tx.productQuantity) : null,
        productMeasure: tx.productMeasure ? String(tx.productMeasure) : null,
        amount: Number(tx.amount ?? 0),
        stationName: tx.stationName ? String(tx.stationName) : null,
        plate,
        carId,
      },
      update: { carId }, // re-match if a new car was added
    });
    inserted++;
  }

  return {
    fetched: rawTransactions.length,
    inserted,
    skipped,
    fromDate: format(fromDate, "yyyy-MM-dd"),
    toDate: format(toDate, "yyyy-MM-dd"),
    chunks: chunks.length,
  };
}
