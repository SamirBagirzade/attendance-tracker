import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeAttendanceInput } from "@/lib/attendance";
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
    },
  });

  if (!record) {
    return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
  }

  return NextResponse.json(record);
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
    });

    const record = await prisma.attendanceRecord.update({
      where: { id },
      data: input,
      include: {
        employee: true,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    return handleAttendanceError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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
