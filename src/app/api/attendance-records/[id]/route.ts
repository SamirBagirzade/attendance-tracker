import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeAttendanceInput } from "@/lib/attendance";
import { toApiDateKey } from "@/lib/dates";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

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

  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
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

  if (!record) {
    return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
  }

  return NextResponse.json(serializeAttendanceRecord(record));
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    const existing = await prisma.attendanceRecord.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
    }

    const body = await request.json();
    const input = normalizeAttendanceInput({
      employeeId: body.employeeId ?? existing.employeeId,
      date: body.date ?? existing.date,
      status: body.status ?? existing.status,
      location: body.location ?? existing.location,
      cookedHeadcount: body.cookedHeadcount ?? existing.cookedHeadcount,
      cookedPaid: body.cookedPaid ?? existing.cookedPaid,
      workLocationIds: body.workLocationIds,
      newWorkLocationNames: body.newWorkLocationNames,
      carDriven: body.carDriven ?? existing.carDriven,
      carId: body.carId ?? existing.carId,
      note: body.note ?? existing.note,
    });

    const record = await prisma.$transaction(async (tx) => {
      const locationIds = [...input.workLocationIds];

      for (const name of input.newWorkLocationNames) {
        const location = await tx.location.upsert({
          where: { name },
          create: { name },
          update: {},
        });
        locationIds.push(location.id);
      }

      await tx.attendanceRecord.update({
        where: { id },
        data: {
          employeeId: input.employeeId,
          date: input.date,
          status: input.status,
          location: input.location,
          cookedHeadcount: input.cookedHeadcount,
          cookedPaid: input.cookedPaid,
          carDriven: input.carDriven,
          carId: input.carId,
          note: input.note,
        },
      });

      await tx.attendanceWorkLocation.deleteMany({
        where: { attendanceRecordId: id },
      });

      if (input.status === "ISDE") {
        const uniqueLocationIds = Array.from(new Set(locationIds));
        await tx.attendanceWorkLocation.createMany({
          data: uniqueLocationIds.map((locationId) => ({
            attendanceRecordId: id,
            locationId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.attendanceRecord.findUniqueOrThrow({
        where: { id },
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

    void logAudit(request, "UPDATE", "AttendanceRecord", id, { status: record.status, date: record.date });
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.attendanceRecord.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
    }

    return NextResponse.json({ error: "Unexpected attendance record error." }, { status: 500 });
  }

  void logAudit(request, "DELETE", "AttendanceRecord", id);
  return new NextResponse(null, { status: 204 });
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
