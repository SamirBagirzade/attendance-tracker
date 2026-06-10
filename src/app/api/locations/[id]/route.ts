import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeLocationInput } from "@/lib/location";
import { prisma } from "@/lib/prisma";

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
    const location = await prisma.location.update({
      where: { id },
      data: normalizeLocationInput(await request.json()),
    });

    return NextResponse.json(location);
  } catch (error) {
    return handleLocationError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.location.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleLocationError(error);
  }
}

function handleLocationError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Location not found." }, { status: 404 });
    }

    if (error.code === "P2002") {
      return NextResponse.json({ error: "Location already exists." }, { status: 409 });
    }
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected location error." }, { status: 500 });
}
