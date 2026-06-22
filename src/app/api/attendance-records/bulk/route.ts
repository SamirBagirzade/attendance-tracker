import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";
import { parseCalendarDate } from "@/lib/dates";
import { requireEditor } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const denied = await requireEditor(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { date, status } = body as { date?: string; status?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)." }, { status: 400 });
  }

  if (!status || !Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
    return NextResponse.json({ error: "status is invalid." }, { status: 400 });
  }

  const parsedDate = parseCalendarDate(date);

  const employees = await prisma.employee.findMany({ select: { id: true } });

  // Upsert only employees who don't already have a record on this date
  const existing = await prisma.attendanceRecord.findMany({
    where: { date: parsedDate },
    select: { employeeId: true },
  });
  const existingIds = new Set(existing.map((r) => r.employeeId));
  const toCreate = employees.filter((e) => !existingIds.has(e.id));

  if (toCreate.length > 0) {
    await prisma.attendanceRecord.createMany({
      data: toCreate.map((e) => ({
        employeeId: e.id,
        date: parsedDate,
        status: status as AttendanceStatus,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ created: toCreate.length, skipped: existingIds.size });
}
