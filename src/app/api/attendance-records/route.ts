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
      workLocations: {
        include: {
          location: true,
        },
      },
      car: true,
    },
    orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
  });

  return NextResponse.json(records.map(serializeAttendanceRecord));
}

export async function POST(request: NextRequest) {
  try {
    const input = normalizeAttendanceInput(await request.json());

    const record = await saveAttendanceRecord(input, false);

    return NextResponse.json(serializeAttendanceRecord(record), { status: 201 });
  } catch (error) {
    return handleAttendanceError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const input = normalizeAttendanceInput(await request.json());

    const record = await saveAttendanceRecord(input, true);

    return NextResponse.json(serializeAttendanceRecord(record));
  } catch (error) {
    return handleAttendanceError(error);
  }
}

function serializeAttendanceRecord<
  T extends {
    date: Date;
    workLocations?: Array<{
      location: {
        id: number;
        name: string;
      };
    }>;
    employee?: {
      createdAt: Date;
      updatedAt: Date;
    } | null;
  },
>(record: T) {
  return {
    ...record,
    date: toApiDateKey(record.date),
    workLocations: record.workLocations?.map((item) => item.location) ?? [],
    employee: record.employee
      ? {
          ...record.employee,
          createdAt: record.employee.createdAt.toISOString(),
          updatedAt: record.employee.updatedAt.toISOString(),
        }
      : record.employee,
  };
}

async function saveAttendanceRecord(
  input: ReturnType<typeof normalizeAttendanceInput>,
  upsert: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const locationIds = [...input.workLocationIds];

    for (const name of input.newWorkLocationNames) {
      const location = await tx.location.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      locationIds.push(location.id);
    }

    const data = {
      employeeId: input.employeeId,
      date: input.date,
      status: input.status,
      location: input.location,
      cookedHeadcount: input.cookedHeadcount,
      cookedPaid: input.cookedPaid,
      carDriven: input.carDriven,
      carId: input.carId,
      note: input.note,
    };

    const record = upsert
      ? await tx.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId: input.employeeId,
              date: input.date,
            },
          },
          create: data,
          update: {
            status: input.status,
            location: input.location,
            cookedHeadcount: input.cookedHeadcount,
            cookedPaid: input.cookedPaid,
            carDriven: input.carDriven,
            carId: input.carId,
            note: input.note,
          },
        })
      : await tx.attendanceRecord.create({ data });

    await tx.attendanceWorkLocation.deleteMany({
      where: { attendanceRecordId: record.id },
    });

    if (input.status === "ISDE") {
      const uniqueLocationIds = Array.from(new Set(locationIds));
      await tx.attendanceWorkLocation.createMany({
        data: uniqueLocationIds.map((locationId) => ({
          attendanceRecordId: record.id,
          locationId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.attendanceRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: {
        employee: true,
        workLocations: {
          include: {
            location: true,
          },
        },
        car: true,
      },
    });
  });
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
