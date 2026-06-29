import { AttendanceStatus, Prisma } from "@prisma/client";
import { addMonths, differenceInDays, isWeekend } from "date-fns";
import { prisma } from "@/lib/prisma";
import { dateRangeWhere, toApiDateKey } from "@/lib/dates";
import { cateringCostForHeadcount, DEFAULT_PRICES, type Prices } from "./catering";

type DateSeverity = "ok" | "warning" | "overdue";

function dateStatus(date: Date | null, intervalMonths: number | null): DateSeverity | null {
  if (!date || !intervalMonths) return null;
  const next = addMonths(date, intervalMonths);
  const days = differenceInDays(next, new Date());
  if (days < 0) return "overdue";
  if (days <= 30) return "warning";
  return "ok";
}

export async function handleToolCall(
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case "get_attendance_summary":
      return getAttendanceSummary(input);
    case "get_employees":
      return getEmployees(input);
    case "get_dashboard":
      return getDashboard();
    case "get_employee_absences":
      return getEmployeeAbsences(input);
    case "get_cook_report":
      return getCookReport(input);
    case "get_car_status":
      return getCarStatus();
    case "get_fuel_transactions":
      return getFuelTransactions(input);
    case "get_employee_details":
      return getEmployeeDetails(input);
    case "get_car_details":
      return getCarDetails(input);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function getAttendanceSummary(input: Record<string, unknown>) {
  const from = String(input.from);
  const to = String(input.to);
  const employeeId = input.employeeId ? Number(input.employeeId) : undefined;
  const department = input.department ? String(input.department) : undefined;
  const status = input.status ? (String(input.status) as AttendanceStatus) : undefined;

  const where: Prisma.AttendanceRecordWhereInput = {
    date: dateRangeWhere(from, to),
  };
  if (employeeId) where.employeeId = employeeId;
  if (department) where.employee = { department };
  if (status) where.status = status;

  const [holidayList, records] = await Promise.all([
    prisma.holiday.findMany({ where: { date: dateRangeWhere(from, to) } }),
    prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: true,
        workLocations: { include: { location: true } },
        car: true,
      },
      orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
    }),
  ]);

  const holidayByDate = new Map(holidayList.map((h) => [toApiDateKey(h.date), h.description]));

  const rows = records.map((r) => {
    const dateKey = toApiDateKey(r.date);
    const holidayDesc = holidayByDate.get(dateKey) ?? null;
    return {
      id: r.id,
      date: dateKey,
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      department: r.employee.department,
      status: r.status,
      location: r.location,
      workLocations: r.workLocations.map((wl) => wl.location.name),
      cookedHeadcount: r.cookedHeadcount,
      cookedPaid: r.cookedPaid,
      carDriven: r.carDriven,
      car: r.car ? `${r.car.makeModel} - ${r.car.licensePlate}` : null,
      note: r.note,
      isWeekend: isWeekend(r.date),
      isHoliday: Boolean(holidayDesc),
      holidayDescription: holidayDesc,
    };
  });

  const workedStatuses = new Set<AttendanceStatus>(["ISDE", "EZAMIYYET", "ISDE_XESARET"]);
  const statusCounts = Object.fromEntries(
    Object.values(AttendanceStatus).map((s) => [s, 0]),
  ) as Record<AttendanceStatus, number>;
  for (const row of rows) statusCounts[row.status]++;

  const RECORD_CAP = 100;
  const truncated = rows.length > RECORD_CAP;

  return {
    summary: {
      totalRecords: rows.length,
      uniqueEmployees: new Set(rows.map((r) => r.employeeId)).size,
      statusCounts,
      isdeDays: rows.filter((r) => r.status === "ISDE").length,
      ezamiyyetDays: rows.filter((r) => r.status === "EZAMIYYET").length,
      carsDrivenDays: rows.filter((r) => r.carDriven).length,
      weekendWorkedDays: rows.filter((r) => r.isWeekend && workedStatuses.has(r.status)).length,
      holidayWorkedDays: rows.filter((r) => r.isHoliday && workedStatuses.has(r.status)).length,
    },
    records: rows.slice(0, RECORD_CAP),
    truncated,
  };
}

async function getEmployees(input: Record<string, unknown>) {
  const department = input.department ? String(input.department) : undefined;
  const employees = await prisma.employee.findMany({
    where: department ? { department } : undefined,
    orderBy: [{ department: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      department: true,
      vacationLimit: true,
      sickLimit: true,
    },
  });
  return { employees };
}

async function getDashboard() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const startOfToday = new Date(todayStr + "T00:00:00.000Z");
  const endOfToday = new Date(todayStr + "T23:59:59.999Z");

  const [employees, todayRecords, cars] = await Promise.all([
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
  ]);

  const statusCounts: Record<string, number> = {};
  for (const r of todayRecords) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  const maintenanceAlerts: {
    id: number;
    makeModel: string;
    licensePlate: string;
    type: string;
    severity: DateSeverity;
  }[] = [];

  for (const car of cars) {
    if (car.currentKm != null && car.oilChangeKm != null && car.oilChangeIntervalKm != null) {
      const next = car.oilChangeKm + car.oilChangeIntervalKm;
      const diff = next - car.currentKm;
      const severity: DateSeverity = diff < 0 ? "overdue" : diff <= 1000 ? "warning" : "ok";
      if (severity !== "ok") {
        maintenanceAlerts.push({
          id: car.id,
          makeModel: car.makeModel,
          licensePlate: car.licensePlate,
          type: "OIL_CHANGE",
          severity,
        });
      }
    } else {
      const oilStat = dateStatus(car.oilChangeDate, null);
      if (oilStat && oilStat !== "ok") {
        maintenanceAlerts.push({
          id: car.id,
          makeModel: car.makeModel,
          licensePlate: car.licensePlate,
          type: "OIL_CHANGE",
          severity: oilStat,
        });
      }
    }

    const insStat = dateStatus(car.insuranceDate, car.insuranceIntervalMonths);
    if (insStat && insStat !== "ok") {
      maintenanceAlerts.push({
        id: car.id,
        makeModel: car.makeModel,
        licensePlate: car.licensePlate,
        type: "INSURANCE",
        severity: insStat,
      });
    }

    const inspStat = dateStatus(car.inspectionDate, car.inspectionIntervalMonths);
    if (inspStat && inspStat !== "ok") {
      maintenanceAlerts.push({
        id: car.id,
        makeModel: car.makeModel,
        licensePlate: car.licensePlate,
        type: "INSPECTION",
        severity: inspStat,
      });
    }
  }

  return {
    date: todayStr,
    totalEmployees: employees.length,
    employeesWithoutRecord: employees.length - todayRecords.length,
    statusCounts,
    maintenanceAlerts,
  };
}

async function getEmployeeAbsences(input: Record<string, unknown>) {
  const year = Number(input.year);
  const employeeId = input.employeeId ? Number(input.employeeId) : undefined;

  const from = new Date(`${year}-01-01T00:00:00.000Z`);
  const to = new Date(`${year}-12-31T23:59:59.999Z`);

  const [records, employees] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        date: { gte: from, lte: to },
        status: { in: ["XESTE", "MEZUNIYYET", "ICAZELI"] },
        ...(employeeId ? { employeeId } : {}),
      },
      select: { employeeId: true, status: true },
    }),
    prisma.employee.findMany({
      where: employeeId ? { id: employeeId } : undefined,
      select: { id: true, name: true, department: true, vacationLimit: true, sickLimit: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
  ]);

  const byEmployee: Record<number, { xeste: number; mezuniyyet: number; icazeli: number }> = {};
  for (const r of records) {
    if (!byEmployee[r.employeeId])
      byEmployee[r.employeeId] = { xeste: 0, mezuniyyet: 0, icazeli: 0 };
    if (r.status === "XESTE") byEmployee[r.employeeId].xeste++;
    if (r.status === "MEZUNIYYET") byEmployee[r.employeeId].mezuniyyet++;
    if (r.status === "ICAZELI") byEmployee[r.employeeId].icazeli++;
  }

  const result = employees.map((emp) => {
    const counts = byEmployee[emp.id] ?? { xeste: 0, mezuniyyet: 0, icazeli: 0 };
    return {
      employeeId: emp.id,
      name: emp.name,
      department: emp.department,
      sickDaysUsed: counts.xeste,
      sickDayLimit: emp.sickLimit ?? null,
      sickDaysRemaining: emp.sickLimit != null ? emp.sickLimit - counts.xeste : null,
      vacationDaysUsed: counts.mezuniyyet,
      vacationDayLimit: emp.vacationLimit ?? null,
      vacationDaysRemaining: emp.vacationLimit != null ? emp.vacationLimit - counts.mezuniyyet : null,
      permittedLeaveUsed: counts.icazeli,
    };
  });

  return { year, absences: result };
}

async function getGlobalCookPrices(): Promise<Prices> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "cook_prices" } });
    if (row) return JSON.parse(row.value) as Prices;
  } catch { /* fall through */ }
  return DEFAULT_PRICES;
}

async function getCookReport(input: Record<string, unknown>) {
  const from = String(input.from);
  const to = String(input.to);
  const employeeId = input.employeeId ? Number(input.employeeId) : undefined;

  const [records, prices] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        date: dateRangeWhere(from, to),
        cookedHeadcount: { gt: 0 },
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: true },
      orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
    }),
    getGlobalCookPrices(),
  ]);

  const grouped = new Map<
    number,
    {
      employeeId: number;
      employeeName: string;
      sessions: Array<{ id: number; date: string; headcount: number; cost: number; paid: boolean }>;
      totalCost: number;
      paidCost: number;
      unpaidCost: number;
    }
  >();

  for (const r of records) {
    const headcount = r.cookedHeadcount ?? 0;
    const cost = cateringCostForHeadcount(headcount, prices);
    const existing = grouped.get(r.employeeId) ?? {
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      sessions: [],
      totalCost: 0,
      paidCost: 0,
      unpaidCost: 0,
    };
    existing.sessions.push({
      id: r.id,
      date: toApiDateKey(r.date),
      headcount,
      cost,
      paid: r.cookedPaid,
    });
    existing.totalCost += cost;
    if (r.cookedPaid) existing.paidCost += cost;
    else existing.unpaidCost += cost;
    grouped.set(r.employeeId, existing);
  }

  const groups = Array.from(grouped.values());
  const grandTotal = groups.reduce((s, g) => s + g.totalCost, 0);
  const grandPaid = groups.reduce((s, g) => s + g.paidCost, 0);
  const grandUnpaid = groups.reduce((s, g) => s + g.unpaidCost, 0);

  return {
    from,
    to,
    groups,
    grandTotal,
    grandPaid,
    grandUnpaid,
    pricingTiers: prices,
  };
}

async function getCarStatus() {
  const cars = await prisma.car.findMany({
    select: {
      id: true,
      makeModel: true,
      licensePlate: true,
      currentKm: true,
      oilChangeDate: true,
      oilChangeKm: true,
      oilBrand: true,
      oilQuantity: true,
      oilChangeIntervalKm: true,
      insuranceDate: true,
      insuranceCompany: true,
      insuranceCost: true,
      insuranceIntervalMonths: true,
      inspectionDate: true,
      inspectionIntervalMonths: true,
    },
  });

  const result = cars.map((car) => {
    let oilSeverity: DateSeverity | null = null;
    if (car.currentKm != null && car.oilChangeKm != null && car.oilChangeIntervalKm != null) {
      const next = car.oilChangeKm + car.oilChangeIntervalKm;
      const diff = next - car.currentKm;
      oilSeverity = diff < 0 ? "overdue" : diff <= 1000 ? "warning" : "ok";
    } else {
      oilSeverity = dateStatus(car.oilChangeDate, null);
    }

    const nextOilKm =
      car.oilChangeKm != null && car.oilChangeIntervalKm != null
        ? car.oilChangeKm + car.oilChangeIntervalKm
        : null;

    const insNext =
      car.insuranceDate && car.insuranceIntervalMonths
        ? addMonths(car.insuranceDate, car.insuranceIntervalMonths).toISOString().slice(0, 10)
        : null;
    const inspNext =
      car.inspectionDate && car.inspectionIntervalMonths
        ? addMonths(car.inspectionDate, car.inspectionIntervalMonths).toISOString().slice(0, 10)
        : null;

    return {
      id: car.id,
      makeModel: car.makeModel,
      licensePlate: car.licensePlate,
      currentKm: car.currentKm,
      oil: {
        lastChangeDate: car.oilChangeDate?.toISOString().slice(0, 10) ?? null,
        lastChangeKm: car.oilChangeKm,
        brand: car.oilBrand,
        quantity: car.oilQuantity,
        intervalKm: car.oilChangeIntervalKm,
        nextChangeKm: nextOilKm,
        severity: oilSeverity,
      },
      insurance: {
        lastDate: car.insuranceDate?.toISOString().slice(0, 10) ?? null,
        company: car.insuranceCompany,
        cost: car.insuranceCost,
        intervalMonths: car.insuranceIntervalMonths,
        nextDate: insNext,
        severity: dateStatus(car.insuranceDate, car.insuranceIntervalMonths),
      },
      inspection: {
        lastDate: car.inspectionDate?.toISOString().slice(0, 10) ?? null,
        intervalMonths: car.inspectionIntervalMonths,
        nextDate: inspNext,
        severity: dateStatus(car.inspectionDate, car.inspectionIntervalMonths),
      },
    };
  });

  return { cars: result };
}

async function getEmployeeDetails(input: Record<string, unknown>) {
  const employeeId = Number(input.employeeId);
  const [employee, customFields, documents] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.customField.findMany({ where: { employeeId }, orderBy: { createdAt: "asc" } }),
    prisma.document.findMany({
      where: { employeeId },
      select: { id: true, name: true, filename: true, size: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);
  if (!employee) return { error: `Employee ${employeeId} not found.` };
  return {
    employee,
    customFields: customFields.map((f) => ({ name: f.name, value: f.value })),
    documents: documents.map((d) => ({ name: d.name, filename: d.filename })),
  };
}

async function getCarDetails(input: Record<string, unknown>) {
  const carId = Number(input.carId);
  const [car, customFields, documents] = await Promise.all([
    prisma.car.findUnique({ where: { id: carId } }),
    prisma.customField.findMany({ where: { carId }, orderBy: { createdAt: "asc" } }),
    prisma.document.findMany({
      where: { carId },
      select: { id: true, name: true, filename: true, size: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);
  if (!car) return { error: `Car ${carId} not found.` };
  return {
    car: { ...car, oilChangeDate: car.oilChangeDate?.toISOString().slice(0, 10) ?? null, insuranceDate: car.insuranceDate?.toISOString().slice(0, 10) ?? null, inspectionDate: car.inspectionDate?.toISOString().slice(0, 10) ?? null },
    customFields: customFields.map((f) => ({ name: f.name, value: f.value })),
    documents: documents.map((d) => ({ name: d.name, filename: d.filename })),
  };
}

async function getFuelTransactions(input: Record<string, unknown>) {
  const from = String(input.from);
  const to = String(input.to);
  const plate = input.plate ? String(input.plate) : undefined;
  const carId = input.carId ? Number(input.carId) : undefined;
  const stationName = input.stationName ? String(input.stationName) : undefined;

  const where: Prisma.FuelTransactionWhereInput = {
    transactionTime: {
      gte: new Date(from + "T00:00:00"),
      lte: new Date(to + "T23:59:59"),
    },
  };
  if (plate) where.plate = { contains: plate, mode: "insensitive" };
  if (carId) where.carId = carId;
  if (stationName) where.stationName = { contains: stationName, mode: "insensitive" };

  const transactions = await prisma.fuelTransaction.findMany({
    where,
    include: { car: { select: { makeModel: true, licensePlate: true } } },
    orderBy: { transactionTime: "desc" },
  });

  const totalAmount = transactions.reduce((s, tx) => s + tx.amount, 0);
  const totalQuantity = transactions.reduce((s, tx) => s + (tx.productQuantity ?? 0), 0);

  const RECORD_CAP = 100;
  const truncated = transactions.length > RECORD_CAP;

  const rows = transactions.slice(0, RECORD_CAP).map((tx) => ({
    date: tx.transactionTime.toISOString().slice(0, 10),
    time: tx.transactionTime.toISOString().slice(11, 16),
    plate: tx.plate,
    car: tx.car ? `${tx.car.makeModel} (${tx.car.licensePlate})` : null,
    product: tx.productName,
    quantity: tx.productQuantity,
    measure: tx.productMeasure,
    amount: tx.amount,
    station: tx.stationName,
    cardHolder: tx.cardHolderName?.trim() ?? null,
  }));

  return {
    summary: {
      totalTransactions: transactions.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalQuantity: Math.round(totalQuantity * 100) / 100,
    },
    transactions: rows,
    truncated,
  };
}
