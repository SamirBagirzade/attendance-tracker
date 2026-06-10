import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { normalizeAttendanceInput } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const employeeId = searchParams.get("employeeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.AttendanceRecordWhereInput = {};

  if (employeeId) {
    const parsedEmployeeId = Number(employeeId);

    if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
      return NextResponse.json({ error: "employeeId must be a positive integer." }, { status: 400 });
    }

    where.employeeId = parsedEmployeeId;
  }

  if (from || to) {
    where.date = {};

    if (from) {
      const fromDate = new Date(from);

      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json({ error: "from must be a valid date." }, { status: 400 });
      }

      where.date.gte = startOfDay(fromDate);
    }

    if (to) {
      const toDate = new Date(to);

      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json({ error: "to must be a valid date." }, { status: 400 });
      }

      where.date.lte = endOfDay(toDate);
    }
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      employee: true,
    },
    orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
  });

  return NextResponse.json(records);
}

export async function POST(request: NextRequest) {
  try {
    const input = normalizeAttendanceInput(await request.json());

    const record = await prisma.attendanceRecord.create({
      data: input,
      include: {
        employee: true,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return handleAttendanceError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const input = normalizeAttendanceInput(await request.json());

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: input.employeeId,
          date: input.date,
        },
      },
      create: input,
      update: {
        status: input.status,
        location: input.location,
        cookedHeadcount: input.cookedHeadcount,
      },
      include: {
        employee: true,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    return handleAttendanceError(error);
  }
}

function handleAttendanceError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: "An attendance record already exists for this employee and date." },
      { status: 409 },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected attendance record error." }, { status: 500 });
}
