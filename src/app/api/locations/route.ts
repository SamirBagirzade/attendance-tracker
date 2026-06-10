import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeLocationInput } from "@/lib/location";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(locations);
}

export async function POST(request: NextRequest) {
  try {
    const location = await prisma.location.create({
      data: normalizeLocationInput(await request.json()),
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    return handleLocationError(error);
  }
}

function handleLocationError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Location already exists." }, { status: 409 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected location error." }, { status: 500 });
}
