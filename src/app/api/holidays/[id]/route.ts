import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeHolidayInput } from "@/lib/holiday";
import { toApiDateKey } from "@/lib/dates";
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
    const holiday = await prisma.holiday.update({
      where: { id },
      data: normalizeHolidayInput(await request.json()),
    });

    return NextResponse.json(serializeHoliday(holiday));
  } catch (error) {
    return handleHolidayError(error);
  }
}

function serializeHoliday<T extends { date: Date }>(holiday: T) {
  return {
    ...holiday,
    date: toApiDateKey(holiday.date),
  };
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.holiday.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleHolidayError(error);
  }
}

function handleHolidayError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Holiday not found." }, { status: 404 });
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A holiday already exists for this date." },
        { status: 409 },
      );
    }
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected holiday error." }, { status: 500 });
}
