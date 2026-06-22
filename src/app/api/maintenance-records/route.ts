import { NextRequest, NextResponse } from "next/server";
import { CarMaintenanceType } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const carId = searchParams.get("carId");
  const type = searchParams.get("type") as CarMaintenanceType | null;

  const records = await prisma.carMaintenanceRecord.findMany({
    where: {
      ...(carId ? { carId: Number(carId) } : {}),
      ...(type ? { type } : {}),
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
  const type = body.type as CarMaintenanceType;
  const dateStr = typeof body.date === "string" ? body.date : null;

  if (!carId || !type || !dateStr) {
    return NextResponse.json({ error: "carId, type, and date are required." }, { status: 400 });
  }

  if (!Object.values(CarMaintenanceType).includes(type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const km = body.km != null && body.km !== "" ? Number(body.km) : null;
  const oilBrand = typeof body.oilBrand === "string" && body.oilBrand.trim() ? body.oilBrand.trim() : null;
  const oilQuantity = body.oilQuantity != null && body.oilQuantity !== "" ? Number(body.oilQuantity) : null;
  const company = typeof body.company === "string" && body.company.trim() ? body.company.trim() : null;
  const cost = body.cost != null && body.cost !== "" ? Number(body.cost) : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  const record = await prisma.carMaintenanceRecord.upsert({
    where: { carId_type_date: { carId, type, date } },
    create: { carId, type, date, km, oilBrand, oilQuantity, company, cost, notes },
    update: { km, oilBrand, oilQuantity, company, cost, notes },
    include: { car: { select: { makeModel: true, licensePlate: true } } },
  });

  void logAudit(request, "UPSERT", "MaintenanceRecord", record.id, { carId: record.carId, type: record.type, date: formatDate(record.date) });
  return NextResponse.json({ ...record, date: formatDate(record.date) }, { status: 201 });
}
