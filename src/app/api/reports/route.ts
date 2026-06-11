import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, Prisma } from "@prisma/client";
import { isWeekend } from "date-fns";
import { dateRangeWhere, toApiDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const workedStatuses = new Set<AttendanceStatus>(["ISDE", "EZAMIYYET", "ISDE_XESARET"]);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const department = searchParams.get("department");
    const status = searchParams.get("status");
    const location = searchParams.get("location");
    const carId = searchParams.get("carId");
    const weekend = searchParams.get("weekend") ?? "all";
    const holiday = searchParams.get("holiday") ?? "all";

    if (!from || !to) {
      return NextResponse.json({ error: "from and to are required." }, { status: 400 });
    }

    const where: Prisma.AttendanceRecordWhereInput = {
      date: dateRangeWhere(from, to),
    };

    if (employeeId) {
      const parsedEmployeeId = Number(employeeId);

      if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
        return NextResponse.json(
          { error: "employeeId must be a positive integer." },
          { status: 400 },
        );
      }

      where.employeeId = parsedEmployeeId;
    }

    if (department) {
      where.employee = { department };
    }

    if (status) {
      if (!Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
        return NextResponse.json({ error: "status is invalid." }, { status: 400 });
      }

      where.status = status as AttendanceStatus;
    }

    if (location) {
      where.OR = [
        { location },
        {
          workLocations: {
            some: {
              location: {
                name: location,
              },
            },
          },
        },
      ];
    }

    if (carId) {
      const parsedCarId = Number(carId);

      if (!Number.isInteger(parsedCarId) || parsedCarId <= 0) {
        return NextResponse.json({ error: "carId must be a positive integer." }, { status: 400 });
      }

      where.carId = parsedCarId;
    }

    const holidays = await prisma.holiday.findMany({
      where: { date: dateRangeWhere(from, to) },
    });
    const holidayByDate = new Map(
      holidays.map((item) => [toApiDateKey(item.date), item.description]),
    );

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: true,
        workLocations: {
          include: {
            location: true,
          },
        },
        car: true,
      },
      orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
    });

    const filteredRows = records
      .map((record) => {
        const dateKey = toApiDateKey(record.date);
        const holidayDescription = holidayByDate.get(dateKey) ?? null;
        const rowIsWeekend = isWeekend(record.date);
        const rowIsHoliday = Boolean(holidayDescription);

        return {
          id: record.id,
          date: dateKey,
          employeeId: record.employeeId,
          employeeName: record.employee.name,
          department: record.employee.department,
          status: record.status,
          location: record.location,
          workLocations: record.workLocations.map((item) => item.location.name),
          cookedHeadcount: record.cookedHeadcount,
          carDriven: record.carDriven,
          car: record.car ? `${record.car.makeModel} - ${record.car.licensePlate}` : null,
          note: record.note,
          isWeekend: rowIsWeekend,
          isHoliday: rowIsHoliday,
          holidayDescription,
        };
      })
      .filter((row) => {
        if (weekend === "yes" && !row.isWeekend) {
          return false;
        }

        if (weekend === "no" && row.isWeekend) {
          return false;
        }

        if (holiday === "yes" && !row.isHoliday) {
          return false;
        }

        if (holiday === "no" && row.isHoliday) {
          return false;
        }

        return true;
      });

    const uniqueLocations = new Set<string>();
    const statusCounts = Object.fromEntries(
      Object.values(AttendanceStatus).map((item) => [item, 0]),
    ) as Record<AttendanceStatus, number>;

    for (const row of filteredRows) {
      statusCounts[row.status] += 1;

      if (row.location) {
        uniqueLocations.add(row.location);
      }

      for (const workLocation of row.workLocations) {
        uniqueLocations.add(workLocation);
      }
    }

    return NextResponse.json({
      summary: {
        totalRecords: filteredRows.length,
        uniqueEmployees: new Set(filteredRows.map((row) => row.employeeId)).size,
        statusCounts,
        isdeDays: filteredRows.filter((row) => row.status === "ISDE").length,
        ezamiyyetDays: filteredRows.filter((row) => row.status === "EZAMIYYET").length,
        carsDrivenDays: filteredRows.filter((row) => row.carDriven).length,
        weekendWorkedDays: filteredRows.filter(
          (row) => row.isWeekend && workedStatuses.has(row.status),
        ).length,
        holidayWorkedDays: filteredRows.filter(
          (row) => row.isHoliday && workedStatuses.has(row.status),
        ).length,
        cookedHeadcountTotal: filteredRows.reduce(
          (sum, row) => sum + (row.cookedHeadcount ?? 0),
          0,
        ),
        uniqueLocations: uniqueLocations.size,
      },
      records: filteredRows,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unexpected report error." }, { status: 500 });
  }
}
