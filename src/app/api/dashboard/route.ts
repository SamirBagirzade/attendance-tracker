import { NextResponse } from "next/server";
import { addMonths, differenceInDays, startOfMonth, endOfMonth, subMonths, subDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";

type DateStatus = "ok" | "warning" | "overdue";

function dateStatus(date: Date | null, intervalMonths: number | null): DateStatus | null {
  if (!date || !intervalMonths) return null;
  const next = addMonths(date, intervalMonths);
  const days = differenceInDays(next, new Date());
  if (days < 0) return "overdue";
  if (days <= 30) return "warning";
  return "ok";
}

export async function GET() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const startOfToday = new Date(todayStr + "T00:00:00.000Z");
  const endOfToday = new Date(todayStr + "T23:59:59.999Z");

  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));
  const thirtyDaysAgo = subDays(startOfToday, 29);

  const [employees, todayRecords, cars, fuelThis, fuelLast, last30Attendance] = await Promise.all([
    prisma.employee.findMany({ select: { id: true } }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: startOfToday, lte: endOfToday } },
      select: { status: true },
    }),
    prisma.car.findMany({
      select: {
        id: true,
        makeModel: true,
        licensePlate: true,
        currentKm: true,
        oilChangeDate: true,
        oilChangeKm: true,
        oilChangeIntervalKm: true,
        insuranceDate: true,
        insuranceIntervalMonths: true,
        inspectionDate: true,
        inspectionIntervalMonths: true,
      },
    }),
    prisma.fuelTransaction.aggregate({
      where: { transactionTime: { gte: thisMonthStart, lte: thisMonthEnd } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.fuelTransaction.aggregate({
      where: { transactionTime: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: thirtyDaysAgo, lte: endOfToday } },
      select: { date: true, status: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const r of todayRecords) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  const employeesWithoutRecord = employees.length - todayRecords.length;

  const maintenanceAlerts: { id: number; makeModel: string; licensePlate: string; type: string; severity: DateStatus }[] = [];

  for (const car of cars) {
    const oilStat = dateStatus(car.oilChangeDate, null);
    // km-based oil check
    if (car.currentKm != null && car.oilChangeKm != null && car.oilChangeIntervalKm != null) {
      const next = car.oilChangeKm + car.oilChangeIntervalKm;
      const diff = next - car.currentKm;
      const severity: DateStatus = diff < 0 ? "overdue" : diff <= 1000 ? "warning" : "ok";
      if (severity !== "ok") {
        maintenanceAlerts.push({ id: car.id, makeModel: car.makeModel, licensePlate: car.licensePlate, type: "OIL_CHANGE", severity });
      }
    } else if (oilStat && oilStat !== "ok") {
      maintenanceAlerts.push({ id: car.id, makeModel: car.makeModel, licensePlate: car.licensePlate, type: "OIL_CHANGE", severity: oilStat });
    }

    const insStat = dateStatus(car.insuranceDate, car.insuranceIntervalMonths);
    if (insStat && insStat !== "ok") {
      maintenanceAlerts.push({ id: car.id, makeModel: car.makeModel, licensePlate: car.licensePlate, type: "INSURANCE", severity: insStat });
    }

    const inspStat = dateStatus(car.inspectionDate, car.inspectionIntervalMonths);
    if (inspStat && inspStat !== "ok") {
      maintenanceAlerts.push({ id: car.id, makeModel: car.makeModel, licensePlate: car.licensePlate, type: "INSPECTION", severity: inspStat });
    }
  }

  // Build 30-day attendance sparkline
  const byDate: Record<string, number> = {};
  for (const r of last30Attendance) {
    if (r.status === "ISDE" || r.status === "EZAMIYYET") {
      const d = format(r.date, "yyyy-MM-dd");
      byDate[d] = (byDate[d] ?? 0) + 1;
    }
  }
  const attendanceTrend: { date: string; present: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(startOfToday, i), "yyyy-MM-dd");
    attendanceTrend.push({ date: d, present: byDate[d] ?? 0 });
  }

  return NextResponse.json({
    totalEmployees: employees.length,
    employeesWithoutRecord,
    statusCounts,
    maintenanceAlerts,
    fuelThisMonth: { total: fuelThis._sum.amount ?? 0, count: fuelThis._count.id },
    fuelLastMonth: { total: fuelLast._sum.amount ?? 0, count: fuelLast._count.id },
    attendanceTrend,
  });
}
