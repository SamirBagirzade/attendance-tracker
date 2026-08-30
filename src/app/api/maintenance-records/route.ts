import { NextRequest, NextResponse } from "next/server";
import { CarMaintenanceType, Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { parseCalendarDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

function isMaintenanceType(value: string): value is CarMaintenanceType {
  return Object.values(CarMaintenanceType).includes(value as CarMaintenanceType);
}

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const carId = searchParams.get("carId");
  const type = searchParams.get("type");

  // Both used to go through unvalidated — a non-numeric carId reached Prisma as
  // NaN and an unknown type as an invalid enum, each surfacing as a 500.
  let parsedCarId: number | undefined;

  if (carId) {
    parsedCarId = Number(carId);

    if (!Number.isInteger(parsedCarId) || parsedCarId <= 0) {
      return NextResponse.json({ error: "carId must be a positive integer." }, { status: 400 });
    }
  }

  let parsedType: CarMaintenanceType | undefined;

  if (type) {
    if (!isMaintenanceType(type)) {
      return NextResponse.json({ error: "type is invalid." }, { status: 400 });
    }

    parsedType = type;
  }

  const records = await prisma.carMaintenanceRecord.findMany({
    where: {
      ...(parsedCarId ? { carId: parsedCarId } : {}),
      ...(parsedType ? { type: parsedType } : {}),
    },
    include: { car: { select: { makeModel: true, licensePlate: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(
    records.map((r) => ({ ...r, date: formatDate(r.date) })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const carId = Number(body.carId);
  const type = typeof body.type === "string" ? body.type : "";
  const dateStr = typeof body.date === "string" ? body.date : null;

  if (!Number.isInteger(carId) || carId <= 0 || !type || !dateStr) {
    return NextResponse.json({ error: "carId, type, and date are required." }, { status: 400 });
  }

  if (!isMaintenanceType(type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  // parseCalendarDate, not new Date: every other @db.Date write normalises to noon
  // UTC, and the @@unique([carId, type, date]) upsert key depends on the stored
  // value matching exactly.
  let date: Date;

  try {
    date = parseCalendarDate(dateStr);
  } catch {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const km = body.km != null && body.km !== "" ? Number(body.km) : null;
  const oilBrand = typeof body.oilBrand === "string" && body.oilBrand.trim() ? body.oilBrand.trim() : null;
  const oilQuantity = body.oilQuantity != null && body.oilQuantity !== "" ? Number(body.oilQuantity) : null;
  const company = typeof body.company === "string" && body.company.trim() ? body.company.trim() : null;
  const cost = body.cost != null && body.cost !== "" ? Number(body.cost) : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  try {
    const record = await prisma.carMaintenanceRecord.upsert({
      where: { carId_type_date: { carId, type, date } },
      create: { carId, type, date, km, oilBrand, oilQuantity, company, cost, notes },
      update: { km, oilBrand, oilQuantity, company, cost, notes },
      include: { car: { select: { makeModel: true, licensePlate: true } } },
    });

    void logAudit(request, "UPSERT", "MaintenanceRecord", record.id, { carId: record.carId, type: record.type, date: formatDate(record.date) });
    return NextResponse.json({ ...record, date: formatDate(record.date) }, { status: 201 });
  } catch (error) {
    // P2003: carId points at a car that doesn't exist. Was an uncaught 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Car not found." }, { status: 400 });
    }

    console.error("[maintenance-records] Upsert failed:", error);
    return NextResponse.json({ error: "Could not save the maintenance record." }, { status: 500 });
  }
}
