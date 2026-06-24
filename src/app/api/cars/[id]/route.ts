import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeCarInput, formatCarDate } from "@/lib/cars";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { handleCarError } from "../route";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) return NextResponse.json({ error: "Car not found." }, { status: 404 });
  return NextResponse.json({ ...car, oilChangeDate: formatCarDate(car.oilChangeDate), insuranceDate: formatCarDate(car.insuranceDate), inspectionDate: formatCarDate(car.inspectionDate) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    const data = normalizeCarInput(await request.json());
    const car = await prisma.car.update({ where: { id }, data });

    void logAudit(request, "UPDATE", "Car", id, { makeModel: car.makeModel, licensePlate: car.licensePlate });
    return NextResponse.json({
      ...car,
      oilChangeDate: formatCarDate(car.oilChangeDate),
      insuranceDate: formatCarDate(car.insuranceDate),
      inspectionDate: formatCarDate(car.inspectionDate),
    });
  } catch (error) {
    return handleCarError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.car.delete({ where: { id } });
    void logAudit(request, "DELETE", "Car", id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Car not found." }, { status: 404 });
    }

    return handleCarError(error);
  }

  return new NextResponse(null, { status: 204 });
}
