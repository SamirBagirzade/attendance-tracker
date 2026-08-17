import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateRangeWhere, toApiDateKey } from "@/lib/dates";

export const runtime = "nodejs";

// Per employee+day form-submission text, for overlaying on the timesheet grid.
// Multiple same-day submissions are concatenated with a newline, in submission order.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const responses = await prisma.formResponse.findMany({
    where: from || to ? { date: dateRangeWhere(from, to) } : undefined,
    orderBy: { submittedAt: "asc" },
    select: { employeeId: true, date: true, activityText: true, absenceReason: true },
  });

  const grouped = new Map<string, string[]>();
  for (const r of responses) {
    const key = `${r.employeeId}:${toApiDateKey(r.date)}`;
    const parts = [r.activityText, r.absenceReason].filter((p): p is string => Boolean(p));
    if (parts.length === 0) continue;
    const line = parts.join(" — ");
    const existing = grouped.get(key) ?? [];
    existing.push(line);
    grouped.set(key, existing);
  }

  const result = Array.from(grouped.entries()).map(([key, lines]) => {
    const [employeeId, date] = key.split(":");
    return { employeeId: Number(employeeId), date, text: lines.join("\n") };
  });

  return NextResponse.json(result);
}
