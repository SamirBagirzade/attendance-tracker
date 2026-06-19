import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getFullYear());

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  const from = new Date(`${year}-01-01T00:00:00.000Z`);
  const to = new Date(`${year}-12-31T23:59:59.999Z`);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: from, lte: to },
      status: { in: ["XESTE", "MEZUNIYYET", "ICAZELI"] },
    },
    select: { employeeId: true, status: true },
  });

  const byEmployee: Record<number, { xeste: number; mezuniyyet: number; icazeli: number }> = {};

  for (const r of records) {
    if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = { xeste: 0, mezuniyyet: 0, icazeli: 0 };
    if (r.status === "XESTE") byEmployee[r.employeeId].xeste++;
    if (r.status === "MEZUNIYYET") byEmployee[r.employeeId].mezuniyyet++;
    if (r.status === "ICAZELI") byEmployee[r.employeeId].icazeli++;
  }

  const result = Object.entries(byEmployee).map(([employeeId, counts]) => ({
    employeeId: Number(employeeId),
    ...counts,
  }));

  return NextResponse.json(result);
}
