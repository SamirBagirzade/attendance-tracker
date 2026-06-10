import { NextRequest, NextResponse } from "next/server";
import { isWeekend } from "date-fns";
import { dateRangeWhere, toApiDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const mode = searchParams.get("mode") ?? "employee";
    const location = searchParams.get("location");

    if (!from || !to) {
      return NextResponse.json({ error: "from and to are required." }, { status: 400 });
    }

    let parsedEmployeeId: number | undefined;

    if (employeeId) {
      parsedEmployeeId = Number(employeeId);

      if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
        return NextResponse.json(
          { error: "employeeId must be a positive integer." },
          { status: 400 },
        );
      }
    }

    const dateFilter = dateRangeWhere(from, to);
    const holidays = await prisma.holiday.findMany({
      where: { date: dateFilter },
    });
    const holidayByDate = new Map(
      holidays.map((holiday) => [toApiDateKey(holiday.date), holiday.description]),
    );

    if (mode === "location") {
      const records = await prisma.attendanceRecord.findMany({
        where: {
          date: dateFilter,
          status: "EZAMIYYET",
          ...(location ? { location } : {}),
        },
        include: {
          employee: true,
        },
        orderBy: [{ location: "asc" }, { date: "asc" }, { employee: { name: "asc" } }],
      });

      const reportsByLocation = new Map<
        string,
        {
          location: string;
          ezamiyyetDays: number;
          uniqueDates: Set<string>;
          employeeIds: Set<number>;
          weekendWorkedDays: number;
          holidayWorkedDays: number;
          cookedHeadcountTotal: number;
          daysByEmployee: Map<string, number>;
          records: Array<{
            id: number;
            date: string;
            employeeId: number;
            employeeName: string;
            department: string;
            cookedHeadcount: number | null;
            isWeekend: boolean;
            isHoliday: boolean;
            holidayDescription: string | null;
          }>;
        }
      >();

      for (const record of records) {
        const reportLocation = record.location ?? "Unspecified";
        const dateKey = toApiDateKey(record.date);
        const holidayDescription = holidayByDate.get(dateKey) ?? null;
        const report =
          reportsByLocation.get(reportLocation) ??
          {
            location: reportLocation,
            ezamiyyetDays: 0,
            uniqueDates: new Set<string>(),
            employeeIds: new Set<number>(),
            weekendWorkedDays: 0,
            holidayWorkedDays: 0,
            cookedHeadcountTotal: 0,
            daysByEmployee: new Map<string, number>(),
            records: [],
          };

        report.ezamiyyetDays += 1;
        report.uniqueDates.add(dateKey);
        report.employeeIds.add(record.employeeId);
        report.cookedHeadcountTotal += record.cookedHeadcount ?? 0;
        report.daysByEmployee.set(
          record.employee.name,
          (report.daysByEmployee.get(record.employee.name) ?? 0) + 1,
        );

        if (isWeekend(record.date)) {
          report.weekendWorkedDays += 1;
        }

        if (holidayDescription) {
          report.holidayWorkedDays += 1;
        }

        report.records.push({
          id: record.id,
          date: dateKey,
          employeeId: record.employeeId,
          employeeName: record.employee.name,
          department: record.employee.department,
          cookedHeadcount: record.cookedHeadcount,
          isWeekend: isWeekend(record.date),
          isHoliday: Boolean(holidayDescription),
          holidayDescription,
        });

        reportsByLocation.set(reportLocation, report);
      }

      return NextResponse.json(
        Array.from(reportsByLocation.values()).map((report) => ({
          location: report.location,
          ezamiyyetDays: report.ezamiyyetDays,
          uniqueDays: report.uniqueDates.size,
          employeeCount: report.employeeIds.size,
          weekendWorkedDays: report.weekendWorkedDays,
          holidayWorkedDays: report.holidayWorkedDays,
          cookedHeadcountTotal: report.cookedHeadcountTotal,
          daysByEmployee: Object.fromEntries(report.daysByEmployee),
          records: report.records,
        })),
      );
    }

    const employees = await prisma.employee.findMany({
      where: parsedEmployeeId ? { id: parsedEmployeeId } : undefined,
      include: {
        attendanceRecords: {
          where: { date: dateFilter },
          orderBy: { date: "asc" },
        },
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    });

    const report = employees.map((employee) => {
      const locationCounts = new Map<string, number>();
      let ezamiyyetDays = 0;
      let weekendWorkedDays = 0;
      let holidayWorkedDays = 0;
      let cookedHeadcountTotal = 0;
      const detailRows = [];

      for (const record of employee.attendanceRecords) {
        const dateKey = toApiDateKey(record.date);
        const holidayDescription = holidayByDate.get(dateKey) ?? null;
        const worked = record.status === "ISDE" || record.status === "EZAMIYYET";

        if (record.status === "EZAMIYYET") {
          ezamiyyetDays += 1;
          const location = record.location ?? "Unspecified";
          locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);
        }

        if (worked && isWeekend(record.date)) {
          weekendWorkedDays += 1;
        }

        if (worked && holidayDescription) {
          holidayWorkedDays += 1;
        }

        cookedHeadcountTotal += record.cookedHeadcount ?? 0;

        detailRows.push({
          id: record.id,
          date: dateKey,
          status: record.status,
          location: record.location,
          cookedHeadcount: record.cookedHeadcount,
          isWeekend: isWeekend(record.date),
          isHoliday: Boolean(holidayDescription),
          holidayDescription,
        });
      }

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        ezamiyyetDays,
        weekendWorkedDays,
        holidayWorkedDays,
        cookedHeadcountTotal,
        ezamiyyetByLocation: Object.fromEntries(locationCounts),
        records: detailRows,
      };
    });

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unexpected report error." }, { status: 500 });
  }
}
