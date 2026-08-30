import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeCarInput, formatCarDate } from "@/lib/cars";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { normalizePlate } from "@/lib/azpetrol-sync";
import { requireEditor } from "@/lib/permissions";

export async function GET() {
  const cars = await prisma.car.findMany({
    orderBy: [{ makeModel: "asc" }, { licensePlate: "asc" }],
  });

  return NextResponse.json(
    cars.map((car) => ({
      ...car,
      oilChangeDate: formatCarDate(car.oilChangeDate),
      insuranceDate: formatCarDate(car.insuranceDate),
      inspectionDate: formatCarDate(car.inspectionDate),
    })),
  );
}

export async function POST(request: NextRequest) {
  const denied = await requireEditor(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const data = normalizeCarInput(body);
    const car = await prisma.car.create({ data });

    // Re-link any historical fuel transactions for this plate. Fire-and-forget,
    // but it must carry its own catch — an unhandled rejection takes the process down.
    void prisma.fuelTransaction
      .updateMany({
        where: { plate: normalizePlate(car.licensePlate), carId: null },
        data: { carId: car.id },
      })
      .catch((error) => console.error("[cars] Fuel re-link failed for car", car.id, error));

    void logAudit(request, "CREATE", "Car", car.id, { makeModel: car.makeModel, licensePlate: car.licensePlate });
    return NextResponse.json(
      {
        ...car,
        oilChangeDate: formatCarDate(car.oilChangeDate),
        insuranceDate: formatCarDate(car.insuranceDate),
        inspectionDate: formatCarDate(car.inspectionDate),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleCarError(error);
  }
}

export function handleCarError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "License plate already exists." }, { status: 409 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected car error." }, { status: 500 });
}
