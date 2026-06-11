import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeCarInput } from "@/lib/cars";
import { prisma } from "@/lib/prisma";
import { handleCarError } from "../route";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    const car = await prisma.car.update({
      where: { id },
      data: normalizeCarInput(await request.json()),
    });

    return NextResponse.json(car);
  } catch (error) {
    return handleCarError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.car.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Car not found." }, { status: 404 });
    }

    return handleCarError(error);
  }

  return new NextResponse(null, { status: 204 });
}
