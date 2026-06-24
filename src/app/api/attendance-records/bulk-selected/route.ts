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

  const { date, status, employeeIds } = body as {
    date?: string;
    status?: string;
    employeeIds?: unknown[];
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)." }, { status: 400 });
  }
  if (!status || !Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    return NextResponse.json({ error: "employeeIds array required." }, { status: 400 });
  }

  const ids = employeeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const parsedDate = parseCalendarDate(date);

  await prisma.$transaction(
    ids.map((employeeId) =>
      prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date: parsedDate } },
        create: { employeeId, date: parsedDate, status: status as AttendanceStatus },
        update: { status: status as AttendanceStatus },
      }),
    ),
  );

  return NextResponse.json({ updated: ids.length });
}
