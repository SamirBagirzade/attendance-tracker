import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { bakuDateKey, parseCalendarDate } from "@/lib/dates";

export const runtime = "nodejs";

// Google Apps Script posts here on every form submit (no session — shared secret instead).
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-forms-secret");
  if (!process.env.FORMS_WEBHOOK_SECRET || secret !== process.env.FORMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();

  const employeeName = typeof body.employeeName === "string" ? body.employeeName.trim() : "";
  if (!employeeName) {
    return NextResponse.json({ error: "employeeName is required." }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: { name: { equals: employeeName, mode: "insensitive" } },
  });

  // No matching employee — discard silently (still 2xx so Apps Script doesn't retry forever).
  if (!employee) {
    return NextResponse.json({ ok: true, discarded: true, reason: "No matching employee." });
  }

  const activityText = typeof body.activityText === "string" ? body.activityText.trim() || null : null;
  const absenceReason = typeof body.absenceReason === "string" ? body.absenceReason.trim() || null : null;

  let submittedAt = new Date();
  if (typeof body.submittedAt === "string") {
    const parsed = new Date(body.submittedAt);
    if (!Number.isNaN(parsed.getTime())) submittedAt = parsed;
  }

  const date = parseCalendarDate(bakuDateKey(submittedAt));

  const saved = await prisma.formResponse.create({
    data: {
      employeeId: employee.id,
      employeeName,
      activityText,
      absenceReason,
      submittedAt,
      date,
      raw: body,
    },
  });

  return NextResponse.json({ ok: true, id: saved.id }, { status: 201 });
}

// Admin-only: review what's been logged so far.
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const responses = await prisma.formResponse.findMany({
    orderBy: { submittedAt: "desc" },
    take: 200,
    include: { employee: { select: { name: true, department: true } } },
  });

  return NextResponse.json(responses);
}
