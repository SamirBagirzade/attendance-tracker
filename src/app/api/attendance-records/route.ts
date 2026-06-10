import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeAttendanceInput } from "@/lib/attendance";
import { dateRangeWhere, toApiDateKey } from "@/lib/dates";
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
    try {
      where.date = dateRangeWhere(from, to);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
    }
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      employee: true,
    },
    orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
  });

  return NextResponse.json(records.map(serializeAttendanceRecord));
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

    return NextResponse.json(serializeAttendanceRecord(record), { status: 201 });
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

    return NextResponse.json(serializeAttendanceRecord(record));
  } catch (error) {
    return handleAttendanceError(error);
  }
}

function serializeAttendanceRecord<
  T extends {
    date: Date;
    employee?: {
      createdAt: Date;
      updatedAt: Date;
    } | null;
  },
>(record: T) {
  return {
    ...record,
    date: toApiDateKey(record.date),
    employee: record.employee
      ? {
          ...record.employee,
          createdAt: record.employee.createdAt.toISOString(),
          updatedAt: record.employee.updatedAt.toISOString(),
        }
      : record.employee,
  };
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
