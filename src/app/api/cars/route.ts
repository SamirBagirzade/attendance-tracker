import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeCarInput, formatCarDate } from "@/lib/cars";
import { prisma } from "@/lib/prisma";

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
  try {
    const body = await request.json();
    const data = normalizeCarInput(body);
    const car = await prisma.car.create({ data });

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
