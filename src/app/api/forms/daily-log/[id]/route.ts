import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseCalendarDate } from "@/lib/dates";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Admin-only: edit content, submission type (which textbox), or date; or delete a submission.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  const body = await request.json();

  const type = body.type;
  if (type !== "activity" && type !== "absence") {
    return NextResponse.json({ error: 'type must be "activity" or "absence".' }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";

  const dateStr = typeof body.date === "string" ? body.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const date = parseCalendarDate(dateStr);

    const updated = await prisma.formResponse.update({
      where: { id },
      data: {
        activityText: type === "activity" ? content || null : null,
        absenceReason: type === "absence" ? content || null : null,
        date,
      },
    });

    void logAudit(request, "UPDATE", "FormResponse", id, { employeeName: updated.employeeName, date: dateStr });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not update submission." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.formResponse.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete submission." }, { status: 500 });
  }

  void logAudit(request, "DELETE", "FormResponse", id);
  return new NextResponse(null, { status: 204 });
}
