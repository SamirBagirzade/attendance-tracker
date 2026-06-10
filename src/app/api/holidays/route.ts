import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeHolidayInput } from "@/lib/holiday";
import { dateRangeWhere, toApiDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const holidays = await prisma.holiday.findMany({
      where: from || to ? { date: dateRangeWhere(from, to) } : undefined,
      orderBy: { date: "asc" },
    });

    return NextResponse.json(holidays.map(serializeHoliday));
  } catch (error) {
    return handleHolidayError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const holiday = await prisma.holiday.create({
      data: normalizeHolidayInput(await request.json()),
    });

    return NextResponse.json(serializeHoliday(holiday), { status: 201 });
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

function handleHolidayError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: "A holiday already exists for this date." },
      { status: 409 },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected holiday error." }, { status: 500 });
}
