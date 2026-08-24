"use client";

import { Fragment, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Banknote, Car, ChefHat, ChevronDown, ChevronRight, Download, FileSpreadsheet, Search, Users, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Alignment, Border, CellValue, Fill, Font, Row, Workbook, Worksheet } from "exceljs";
import { AppShell } from "@/components/AppShell";
import { parseCalendarDate } from "@/lib/dates";
import { statusKey, useLanguage } from "@/lib/i18n";
import type {
  AttendanceStatus,
  Car as CarType,
  Employee,
  ExpenseType,
  FilteredReport,
  FilteredReportRow,
  Location,
  PaymentType,
} from "@/types/domain";

const statusOptions: AttendanceStatus[] = [
  "ISDE",
  "EZAMIYYET",
  "MEZUNIYYET",
  "XESTE",
  "BAYRAM",
  "ICAZELI",
  "ISTIRAHET",
  "ISDE_DEYIL",
  "ISDE_XESARET",
];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  ISDE: "#22c55e",
  EZAMIYYET: "#3b82f6",
  MEZUNIYYET: "#f59e0b",
  XESTE: "#ef4444",
  BAYRAM: "#a855f7",
  ICAZELI: "#f97316",
  ISTIRAHET: "#94a3b8",
  ISDE_DEYIL: "#6b7280",
  ISDE_XESARET: "#f43f5e",
};

import { type Prices, DEFAULT_PRICES, cateringCostForHeadcount } from "@/lib/ai/catering";

type CookGroup = {
  employeeId: number;
  employeeName: string;
  sessions: Array<{ id: number; date: string; headcount: number; cost: number; paid: boolean }>;
  totalCost: number;
  paidCost: number;
  unpaidCost: number;
};

// Bonus/Ezam əlavə are money the company owes the employee (Payments section).
// Avans is a debt the employee owes the company — tracked separately (Employee Debt section).
const nonDebtPaymentTypes: Array<"BONUS" | "EZAM_ELAVE"> = ["BONUS", "EZAM_ELAVE"];

const paymentTypeLabelKey: Record<PaymentType, string> = {
  BONUS: "paymentBonus",
  EZAM_ELAVE: "paymentEzamElave",
  AVANS: "paymentAvans",
};

type PaymentGroup = {
  employeeId: number;
  employeeName: string;
  sessions: Array<{ id: number; date: string; type: "BONUS" | "EZAM_ELAVE"; amount: number; paid: number }>;
  totalAmount: number;
  totalPaid: number;
  byType: Record<"BONUS" | "EZAM_ELAVE", number>;
};

type AvansGroup = {
  employeeId: number;
  employeeName: string;
  sessions: Array<{ id: number; date: string; given: number; repaid: number; outstanding: number }>;
  totalGiven: number;
  totalRepaid: number;
  totalOutstanding: number;
};

const expenseTypeValues: ExpenseType[] = ["FOOD", "TOOL", "FINE", "OTHER"];

const expenseTypeLabelKey: Record<ExpenseType, string> = {
  FOOD: "expenseFood",
  TOOL: "expenseTool",
  FINE: "expenseFine",
  OTHER: "other",
};

type ExpenseGroup = {
  employeeId: number;
  employeeName: string;
  sessions: Array<{ id: number; date: string; type: ExpenseType; amount: number }>;
  totalAmount: number;
  byType: Record<ExpenseType, number>;
};

const TIER_KEYS: Array<{ key: keyof Prices; label: string }> = [
  { key: "tier1", label: "1" },
  { key: "tier2", label: "2" },
  { key: "tier3", label: "3" },
  { key: "tier4", label: "4" },
  { key: "tier5plus", label: "5+" },
];

export default function ReportsPage() {
  const { t } = useLanguage();
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cars, setCars] = useState<CarType[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [carId, setCarId] = useState("");
  const [weekend, setWeekend] = useState("all");
  const [holiday, setHoliday] = useState("all");
  const [report, setReport] = useState<FilteredReport | null>(null);
  const [error, setError] = useState("");
  const [prices, setPrices] = useState<Prices>(DEFAULT_PRICES);
  const [formNotes, setFormNotes] = useState<Array<{ employeeId: number; date: string; text: string }>>([]);

  const [expandedCookEmployees, setExpandedCookEmployees] = useState<Set<number>>(new Set());
  const [expandedPaymentEmployees, setExpandedPaymentEmployees] = useState<Set<number>>(new Set());
  const [expandedAvansEmployees, setExpandedAvansEmployees] = useState<Set<number>>(new Set());
  const [expandedExpenseEmployees, setExpandedExpenseEmployees] = useState<Set<number>>(new Set());

  const [empReportOpen, setEmpReportOpen] = useState(false);
  const [empReportEmployeeId, setEmpReportEmployeeId] = useState("");
  const [empReportFrom, setEmpReportFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [empReportTo, setEmpReportTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [empReportLoading, setEmpReportLoading] = useState(false);
  const [empReportError, setEmpReportError] = useState("");

  function updateRecord(id: number, updates: Partial<FilteredReportRow>) {
    setReport((prev) =>
      prev
        ? { ...prev, records: prev.records.map((r) => (r.id === id ? { ...r, ...updates } : r)) }
        : null,
    );
  }

  async function toggleCookPaid(recordId: number, currentPaid: boolean) {
    const newPaid = !currentPaid;
    updateRecord(recordId, { cookedPaid: newPaid });
    const res = await fetch(`/api/attendance-records/${recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookedPaid: newPaid }),
    });
    if (!res.ok) {
      updateRecord(recordId, { cookedPaid: currentPaid });
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not update.");
    }
  }

  async function updatePaymentPaid(recordId: number, currentPaid: number, nextValue: number) {
    const clamped = Math.max(0, nextValue);
    updateRecord(recordId, { paymentPaid: clamped });
    const res = await fetch(`/api/attendance-records/${recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPaid: clamped }),
    });
    if (!res.ok) {
      updateRecord(recordId, { paymentPaid: currentPaid });
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not update.");
    }
  }

  async function updatePrice(key: keyof Prices, value: number) {
    const next = { ...prices, [key]: Math.max(0, value) };
    setPrices(next);
    await fetch("/api/settings/cook-prices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees],
  );
  const rows = useMemo(() => report?.records ?? [], [report]);
  const canDownload = rows.length > 0;
  const byEmployee = useMemo(() => groupByEmployee(rows, prices), [rows, prices]);
  const byLocation = useMemo(() => groupByLocation(rows), [rows]);
  const formNoteByCell = useMemo(
    () => new Map(formNotes.map((item) => [`${item.employeeId}:${item.date}`, item.text])),
    [formNotes],
  );

  // --- Chart data ---

  const dailyChartData = useMemo(() => {
    const grouped = new Map<
      string,
      { isde: number; ezamiyyet: number; other: number; cookedHeadcount: number }
    >();

    for (const row of rows) {
      const d = grouped.get(row.date) ?? {
        isde: 0,
        ezamiyyet: 0,
        other: 0,
        cookedHeadcount: 0,
      };
      if (row.status === "ISDE") d.isde += 1;
      else if (row.status === "EZAMIYYET") d.ezamiyyet += 1;
      else d.other += 1;
      if (row.cookedHeadcount != null) d.cookedHeadcount += row.cookedHeadcount;
      grouped.set(row.date, d);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({
        date: date.slice(5),
        fullDate: date,
        isde: d.isde,
        ezamiyyet: d.ezamiyyet,
        other: d.other,
        cookedHeadcount: d.cookedHeadcount,
        cost: cateringCostForHeadcount(d.cookedHeadcount, prices),
      }));
  }, [rows, prices]);

  const cateringDays = useMemo(
    () => dailyChartData.filter((d) => d.cookedHeadcount > 0),
    [dailyChartData],
  );

  // Individual cook records for the breakdown table
  const cateringRecords = useMemo(
    () =>
      rows
        .filter((r) => r.cookedHeadcount != null && r.cookedHeadcount > 0)
        .map((r) => ({
          ...r,
          cost: cateringCostForHeadcount(r.cookedHeadcount!, prices),
        })),
    [rows, prices],
  );

  const totalCateringCost = useMemo(
    () => cateringRecords.reduce((s, r) => s + r.cost, 0),
    [cateringRecords],
  );

  const paidCateringCost = useMemo(
    () => cateringRecords.filter((r) => r.cookedPaid).reduce((s, r) => s + r.cost, 0),
    [cateringRecords],
  );

  const unpaidCateringCost = useMemo(
    () => cateringRecords.filter((r) => !r.cookedPaid).reduce((s, r) => s + r.cost, 0),
    [cateringRecords],
  );

  const cateringByEmployee = useMemo<CookGroup[]>(() => {
    const grouped = new Map<number, CookGroup>();
    for (const r of cateringRecords) {
      const group = grouped.get(r.employeeId) ?? {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        sessions: [],
        totalCost: 0,
        paidCost: 0,
        unpaidCost: 0,
      };
      group.sessions.push({ id: r.id, date: r.date, headcount: r.cookedHeadcount!, cost: r.cost, paid: r.cookedPaid });
      group.totalCost += r.cost;
      if (r.cookedPaid) group.paidCost += r.cost;
      else group.unpaidCost += r.cost;
      grouped.set(r.employeeId, group);
    }
    return Array.from(grouped.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [cateringRecords]);

  // Individual payment records for the breakdown table (Bonus / Ezam əlavə only — company owes employee)
  const paymentRecords = useMemo(
    () =>
      rows
        .filter((r) => (r.paymentType === "BONUS" || r.paymentType === "EZAM_ELAVE") && r.paymentAmount != null)
        .map((r) => ({
          ...r,
          type: r.paymentType as "BONUS" | "EZAM_ELAVE",
          amount: r.paymentAmount as number,
          paid: r.paymentPaid ?? 0,
        })),
    [rows],
  );

  const totalPaymentAmount = useMemo(
    () => paymentRecords.reduce((s, r) => s + r.amount, 0),
    [paymentRecords],
  );

  const totalPaymentPaid = useMemo(
    () => paymentRecords.reduce((s, r) => s + r.paid, 0),
    [paymentRecords],
  );

  const totalPaymentUnpaid = useMemo(
    () => Math.max(0, totalPaymentAmount - totalPaymentPaid),
    [totalPaymentAmount, totalPaymentPaid],
  );

  const paymentTotalsByType = useMemo(() => {
    const totals: Record<"BONUS" | "EZAM_ELAVE", number> = { BONUS: 0, EZAM_ELAVE: 0 };
    for (const r of paymentRecords) totals[r.type] += r.amount;
    return totals;
  }, [paymentRecords]);

  const paymentByEmployee = useMemo<PaymentGroup[]>(() => {
    const grouped = new Map<number, PaymentGroup>();
    for (const r of paymentRecords) {
      const group = grouped.get(r.employeeId) ?? {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        sessions: [],
        totalAmount: 0,
        totalPaid: 0,
        byType: { BONUS: 0, EZAM_ELAVE: 0 },
      };
      group.sessions.push({ id: r.id, date: r.date, type: r.type, amount: r.amount, paid: r.paid });
      group.totalAmount += r.amount;
      group.totalPaid += r.paid;
      group.byType[r.type] += r.amount;
      grouped.set(r.employeeId, group);
    }
    return Array.from(grouped.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [paymentRecords]);

  // Avans (advance) records — a debt the employee owes the company, tracked separately
  const avansRecords = useMemo(
    () =>
      rows
        .filter((r) => r.paymentType === "AVANS" && r.paymentAmount != null)
        .map((r) => {
          const given = r.paymentAmount as number;
          const repaid = r.paymentPaid ?? 0;
          return { ...r, given, repaid, outstanding: Math.max(0, given - repaid) };
        }),
    [rows],
  );

  const totalAvansGiven = useMemo(() => avansRecords.reduce((s, r) => s + r.given, 0), [avansRecords]);
  const totalAvansRepaid = useMemo(() => avansRecords.reduce((s, r) => s + r.repaid, 0), [avansRecords]);
  const totalAvansOutstanding = useMemo(
    () => Math.max(0, totalAvansGiven - totalAvansRepaid),
    [totalAvansGiven, totalAvansRepaid],
  );

  const avansByEmployee = useMemo<AvansGroup[]>(() => {
    const grouped = new Map<number, AvansGroup>();
    for (const r of avansRecords) {
      const group = grouped.get(r.employeeId) ?? {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        sessions: [],
        totalGiven: 0,
        totalRepaid: 0,
        totalOutstanding: 0,
      };
      group.sessions.push({ id: r.id, date: r.date, given: r.given, repaid: r.repaid, outstanding: r.outstanding });
      group.totalGiven += r.given;
      group.totalRepaid += r.repaid;
      grouped.set(r.employeeId, group);
    }
    return Array.from(grouped.values())
      .map((group) => ({ ...group, totalOutstanding: Math.max(0, group.totalGiven - group.totalRepaid) }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [avansRecords]);

  // Expense records — company spending routed through an employee (food, tools, fines). Not debt.
  const expenseRecords = useMemo(
    () =>
      rows
        .filter((r) => r.expenseType != null && r.expenseAmount != null)
        .map((r) => ({ ...r, type: r.expenseType as ExpenseType, amount: r.expenseAmount as number })),
    [rows],
  );

  const totalExpenseAmount = useMemo(
    () => expenseRecords.reduce((s, r) => s + r.amount, 0),
    [expenseRecords],
  );

  const expenseTotalsByType = useMemo(() => {
    const totals: Record<ExpenseType, number> = { FOOD: 0, TOOL: 0, FINE: 0, OTHER: 0 };
    for (const r of expenseRecords) totals[r.type] += r.amount;
    return totals;
  }, [expenseRecords]);

  const expenseByEmployee = useMemo<ExpenseGroup[]>(() => {
    const grouped = new Map<number, ExpenseGroup>();
    for (const r of expenseRecords) {
      const group = grouped.get(r.employeeId) ?? {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        sessions: [],
        totalAmount: 0,
        byType: { FOOD: 0, TOOL: 0, FINE: 0, OTHER: 0 },
      };
      group.sessions.push({ id: r.id, date: r.date, type: r.type, amount: r.amount });
      group.totalAmount += r.amount;
      group.byType[r.type] += r.amount;
      grouped.set(r.employeeId, group);
    }
    return Array.from(grouped.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [expenseRecords]);

  const statusChartData = useMemo(() => {
    if (!report) return [];
    return statusOptions
      .map((s) => ({
        name: t(statusKey(s)),
        value: (report.summary.statusCounts as Record<AttendanceStatus, number>)[s] ?? 0,
        status: s,
      }))
      .filter((d) => d.value > 0);
  }, [report, t]);

  // --- Data loading ---

  const loadOptions = useCallback(async () => {
    const [empRes, locRes, carRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/locations"),
      fetch("/api/cars"),
    ]);

    if (!empRes.ok || !locRes.ok || !carRes.ok) {
      setError("Could not load report options.");
      return;
    }

    setEmployees(await empRes.json());
    setLocations(await locRes.json());
    setCars(await carRes.json());
  }, []);

  const loadReport = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ from, to });
    if (employeeId) params.set("employeeId", employeeId);
    if (department) params.set("department", department);
    if (status) params.set("status", status);
    if (location) params.set("location", location);
    if (carId) params.set("carId", carId);
    if (weekend !== "all") params.set("weekend", weekend);
    if (holiday !== "all") params.set("holiday", holiday);

    const res = await fetch(`/api/reports?${params.toString()}`);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not load report.");
      return;
    }

    setReport(await res.json());
  }, [carId, department, employeeId, from, holiday, location, status, to, weekend]);

  useEffect(() => {
    void fetch("/api/settings/cook-prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setPrices(data as Prices); });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    void fetch(`/api/forms/daily-log/summary?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setFormNotes(data));
  }, [from, to]);

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReport();
  }

  async function downloadExcel() {
    if (!report) return;

    const mod = await import("exceljs");
    const ExcelJSLib = (mod as unknown as { default?: typeof mod }).default ?? mod;
    const workbook = new ExcelJSLib.Workbook();
    workbook.creator = "Attendance Tracker";
    workbook.created = new Date();

    buildSummarySheet(workbook, {
      from,
      to,
      filters: {
        employee: employeeLabel(employees, employeeId) || t("allEmployees"),
        department: department || t("allDepartments"),
        status: status ? t(statusKey(status)) : t("allStatuses"),
        location: location || t("allLocations"),
        car: carLabel(cars, carId) || t("allCars"),
        weekend: optionLabel(weekend),
        holiday: optionLabel(holiday),
      },
      summary: report.summary,
      catering: { total: totalCateringCost, paid: paidCateringCost, unpaid: unpaidCateringCost, days: cateringDays.length },
      payments: { total: totalPaymentAmount, paid: totalPaymentPaid, unpaid: totalPaymentUnpaid },
      debt: { given: totalAvansGiven, repaid: totalAvansRepaid, outstanding: totalAvansOutstanding },
      expense: { total: totalExpenseAmount },
      t,
    });

    buildByEmployeeSheet(workbook, byEmployee, employees, t);
    buildCateringSheet(workbook, cateringDays, cateringByEmployee);
    buildPaymentsSheet(workbook, paymentByEmployee, t);
    buildDebtSheet(workbook, avansByEmployee);
    buildExpensesSheet(workbook, expenseByEmployee, t);
    buildByLocationSheet(workbook, byLocation, t);
    buildRecordsSheet(workbook, exportRows(rows, t, formNoteByCell));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_report_${from}_${to}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadEmployeeExcel() {
    if (!empReportEmployeeId) {
      setEmpReportError(t("selectEmployeeRequired"));
      return;
    }
    if (empReportFrom > empReportTo) {
      setEmpReportError(t("dateRangeInvalid"));
      return;
    }

    setEmpReportError("");
    setEmpReportLoading(true);

    try {
      const params = new URLSearchParams({ employeeId: empReportEmployeeId, from: empReportFrom, to: empReportTo });
      const [res, formNotesRes] = await Promise.all([
        fetch(`/api/reports?${params.toString()}`),
        fetch(`/api/forms/daily-log/summary?from=${empReportFrom}&to=${empReportTo}`),
      ]);

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Could not load employee report.");
      }

      const data = (await res.json()) as FilteredReport;
      const empFormNotes = formNotesRes.ok
        ? ((await formNotesRes.json()) as Array<{ employeeId: number; date: string; text: string }>)
        : [];
      const empFormNoteByCell = new Map(empFormNotes.map((item) => [`${item.employeeId}:${item.date}`, item.text]));
      const emp = employees.find((e) => e.id.toString() === empReportEmployeeId);

      const mod = await import("exceljs");
      const ExcelJSLib = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const workbook = new ExcelJSLib.Workbook();
      workbook.creator = "Attendance Tracker";
      workbook.created = new Date();

      buildEmployeeReport(workbook, {
        employee: emp ?? null,
        from: empReportFrom,
        to: empReportTo,
        rows: data.records,
        summary: data.summary,
        prices,
        formNoteByCell: empFormNoteByCell,
        t,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `employee_report_${sanitizeFilename(emp?.name ?? "employee")}_${empReportFrom}_${empReportTo}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setEmpReportOpen(false);
    } catch (err) {
      setEmpReportError(err instanceof Error ? err.message : "Could not generate employee report.");
    } finally {
      setEmpReportLoading(false);
    }
  }

  return (
    <AppShell eyebrow={`${from} – ${to}`} title={t("reports")}>
      <div className="grid gap-6">
        {/* Filters */}
        <form
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4 xl:grid-cols-8"
          onSubmit={submitReport}
        >
          <SelectField label={t("employee")} onChange={setEmployeeId} value={employeeId}>
            <option value="">{t("allEmployees")}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} – {emp.department}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("department")} onChange={setDepartment} value={department}>
            <option value="">{t("allDepartments")}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("status")} onChange={setStatus} value={status}>
            <option value="">{t("allStatuses")}</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {t(statusKey(s))}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("location")} onChange={setLocation} value={location}>
            <option value="">{t("allLocations")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("cars")} onChange={setCarId} value={carId}>
            <option value="">{t("allCars")}</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.makeModel} – {c.licensePlate}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("weekend")} onChange={setWeekend} value={weekend}>
            <option value="all">{t("allDays")}</option>
            <option value="yes">{t("onlyWeekend")}</option>
            <option value="no">{t("excludeWeekend")}</option>
          </SelectField>
          <SelectField label={t("holiday")} onChange={setHoliday} value={holiday}>
            <option value="all">{t("allDays")}</option>
            <option value="yes">{t("onlyHoliday")}</option>
            <option value="no">{t("excludeHoliday")}</option>
          </SelectField>
          <DateField label={t("from")} onChange={setFrom} value={from} />
          <DateField label={t("to")} onChange={setTo} value={to} />
          <div className="flex items-end gap-2 lg:col-span-4 xl:col-span-8">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Search size={16} />
              {t("run")}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canDownload}
              onClick={() => void downloadExcel()}
              type="button"
            >
              <Download size={16} />
              {t("excel")}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => { setEmpReportError(""); setEmpReportOpen(true); }}
              type="button"
            >
              <FileSpreadsheet size={16} />
              {t("employeeReport")}
            </button>
          </div>
        </form>

        {empReportOpen ? (
          <EmployeeReportModal
            employeeId={empReportEmployeeId}
            employees={employees}
            error={empReportError}
            from={empReportFrom}
            loading={empReportLoading}
            onClose={() => setEmpReportOpen(false)}
            onEmployeeIdChange={setEmpReportEmployeeId}
            onFromChange={setEmpReportFrom}
            onGenerate={() => void downloadEmployeeExcel()}
            onToChange={setEmpReportTo}
            t={t}
            to={empReportTo}
          />
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {report ? (
          <>
            {/* KPI Cards */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <MetricCard
                color="slate"
                label={t("records")}
                value={report.summary.totalRecords}
              />
              <MetricCard
                color="slate"
                icon={<Users size={18} />}
                label={t("employees")}
                value={report.summary.uniqueEmployees}
              />
              <MetricCard
                color="green"
                label={t("statusISDE")}
                value={report.summary.isdeDays}
              />
              <MetricCard
                color="blue"
                label={t("statusEZAMIYYET")}
                value={report.summary.ezamiyyetDays}
              />
              <MetricCard
                color="slate"
                icon={<Car size={18} />}
                label={t("carsDriven")}
                value={report.summary.carsDrivenDays}
              />
              <MetricCard
                color="teal"
                icon={<ChefHat size={18} />}
                label={t("cateringCost")}
                value={`₼${totalCateringCost}`}
              />
            </section>

            {/* Charts */}
            <section className="grid gap-4 xl:grid-cols-5">
              {/* Status donut */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <h2 className="mb-1 font-semibold text-slate-950">{t("statusBreakdown")}</h2>
                <p className="mb-4 text-xs text-slate-500">
                  {report.summary.totalRecords} {t("records")}
                </p>
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer height={280} width="100%">
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="42%"
                        data={statusChartData}
                        dataKey="value"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {statusChartData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status as AttendanceStatus]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        formatter={(value) => (
                          <span style={{ fontSize: 11, color: "#64748b" }}>{value}</span>
                        )}
                        iconSize={10}
                        iconType="circle"
                        wrapperStyle={{ paddingTop: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                    No data
                  </div>
                )}
              </div>

              {/* Daily attendance stacked bar */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
                <h2 className="mb-1 font-semibold text-slate-950">{t("dailyAttendance")}</h2>
                <p className="mb-4 text-xs text-slate-500">{from} – {to}</p>
                {dailyChartData.length > 0 ? (
                  <ResponsiveContainer height={280} width="100%">
                    <BarChart
                      data={dailyChartData}
                      margin={{ top: 0, right: 4, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        interval="preserveStartEnd"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        formatter={(value) => (
                          <span style={{ fontSize: 11, color: "#64748b" }}>{value}</span>
                        )}
                        iconSize={10}
                        iconType="circle"
                      />
                      <Bar
                        dataKey="isde"
                        fill="#22c55e"
                        name={t("statusISDE")}
                        radius={[0, 0, 0, 0]}
                        stackId="a"
                      />
                      <Bar
                        dataKey="ezamiyyet"
                        fill="#3b82f6"
                        name={t("statusEZAMIYYET")}
                        stackId="a"
                      />
                      <Bar
                        dataKey="other"
                        fill="#cbd5e1"
                        name={t("other")}
                        radius={[2, 2, 0, 0]}
                        stackId="a"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                    No data
                  </div>
                )}
              </div>
            </section>

            {/* Catering Cost section */}
            {cateringDays.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-3">
                {/* Summary + tiers */}
                <div className="flex flex-col gap-4 rounded-xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-teal-700">
                    <ChefHat size={20} />
                    <h2 className="font-semibold">{t("cateringCost")}</h2>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-teal-900">₼{totalCateringCost}</div>
                    <div className="mt-1 text-sm text-teal-600">
                      {cateringDays.length} {t("cateringDays")}
                    </div>
                  </div>
                  {/* Paid / unpaid split */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                      <div className="text-xs font-semibold text-emerald-600">{t("paid")}</div>
                      <div className="mt-1 text-xl font-bold text-emerald-800">₼{paidCateringCost}</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <div className="text-xs font-semibold text-amber-600">{t("unpaid")}</div>
                      <div className="mt-1 text-xl font-bold text-amber-800">₼{unpaidCateringCost}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-white/60 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-600">
                      {t("pricingTiers")}
                    </div>
                    <div className="space-y-2">
                      {TIER_KEYS.map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-teal-800">
                            {label} {t("people")}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-teal-600">₼</span>
                            <input
                              className="w-16 rounded border border-teal-300 bg-white px-2 py-1 text-right text-sm font-semibold text-teal-900 focus:outline-none focus:border-teal-500"
                              min={0}
                              onChange={(e) => void updatePrice(key, Number(e.target.value))}
                              type="number"
                              value={prices[key]}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Per-day cost chart + table */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                  <h2 className="font-semibold text-slate-950">{t("cateringCostByDay")}</h2>
                  <ResponsiveContainer height={180} width="100%">
                    <BarChart
                      data={cateringDays}
                      margin={{ top: 0, right: 4, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        tickFormatter={(v) => `₼${v}`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const d = cateringDays.find((x) => x.date === label);
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                              <div className="mb-1 font-semibold text-slate-900">
                                {d?.fullDate ?? label}
                              </div>
                              <div className="text-slate-500">
                                {d?.cookedHeadcount} {t("people")}
                              </div>
                              <div className="font-semibold text-teal-700">
                                ₼{payload[0]?.value}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="cost" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Per-employee catering table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("employee")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("records")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("cost")}</th>
                          <th className="px-4 py-2.5 text-center font-medium text-slate-600">{t("paid")}</th>
                          <th className="px-4 py-2.5 text-center font-medium text-slate-600">{t("unpaid")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cateringByEmployee.map((group) => {
                          const isExpanded = expandedCookEmployees.has(group.employeeId);
                          const toggle = () =>
                            setExpandedCookEmployees((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.employeeId)) next.delete(group.employeeId);
                              else next.add(group.employeeId);
                              return next;
                            });
                          return (
                            <Fragment key={group.employeeId}>
                              <tr
                                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                                key={`group-${group.employeeId}`}
                                onClick={toggle}
                              >
                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                  <span className="inline-flex items-center gap-1.5">
                                    {group.sessions.length > 1 ? (
                                      isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                                    ) : (
                                      <span className="w-[14px]" />
                                    )}
                                    {group.employeeName}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.sessions.length}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-teal-700">₼{group.totalCost}</td>
                                <td className="px-4 py-2.5 text-center">
                                  {group.paidCost > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                      ₼{group.paidCost}
                                    </span>
                                  ) : <span className="text-slate-300">–</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {group.unpaidCost > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                      ₼{group.unpaidCost}
                                    </span>
                                  ) : <span className="text-slate-300">–</span>}
                                </td>
                              </tr>
                              {isExpanded && group.sessions.map((s) => (
                                <tr className="border-t border-slate-50 bg-slate-50/60" key={`session-${s.id}`}>
                                  <td className="py-2 pl-10 pr-4 text-slate-500">{s.date}</td>
                                  <td className="px-4 py-2 text-right text-slate-500">{s.headcount} {t("people")}</td>
                                  <td className="px-4 py-2 text-right text-teal-600">₼{s.cost}</td>
                                  <td className="px-4 py-2 text-center" colSpan={2}>
                                    <button
                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                                        s.paid
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                          : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                      }`}
                                      onClick={(e) => { e.stopPropagation(); void toggleCookPaid(s.id, s.paid); }}
                                      type="button"
                                    >
                                      {s.paid ? `✓ ${t("paid")}` : `● ${t("unpaid")}`}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                        <tr>
                          <td className="px-4 py-2.5 font-semibold text-slate-900" colSpan={2}>{t("total")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-teal-900">₼{totalCateringCost}</td>
                          <td className="px-4 py-2.5 text-center">
                            {paidCateringCost > 0 && <span className="text-xs font-semibold text-emerald-700">₼{paidCateringCost}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {unpaidCateringCost > 0 && <span className="text-xs font-semibold text-amber-700">₼{unpaidCateringCost}</span>}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Payments section */}
            {paymentRecords.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-3">
                {/* Summary + by-type totals */}
                <div className="flex flex-col gap-4 rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-purple-700">
                    <Banknote size={20} />
                    <h2 className="font-semibold">{t("payments")}</h2>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-purple-900">₼{totalPaymentAmount}</div>
                    <div className="mt-1 text-sm text-purple-600">
                      {paymentRecords.length} {t("records")}
                    </div>
                  </div>
                  {/* Paid / unpaid split */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                      <div className="text-xs font-semibold text-emerald-600">{t("paymentsPaidTotal")}</div>
                      <div className="mt-1 text-xl font-bold text-emerald-800">₼{totalPaymentPaid}</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <div className="text-xs font-semibold text-amber-600">{t("paymentsUnpaidTotal")}</div>
                      <div className="mt-1 text-xl font-bold text-amber-800">₼{totalPaymentUnpaid}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-purple-200 bg-white/60 p-3">
                    <div className="space-y-2">
                      {nonDebtPaymentTypes.map((type) => (
                        <div key={type} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-purple-800">{t(paymentTypeLabelKey[type])}</span>
                          <span className="text-sm font-semibold text-purple-900">₼{paymentTotalsByType[type]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Per-employee payments table */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                  <h2 className="font-semibold text-slate-950">{t("byEmployee")}</h2>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("employee")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("records")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t(paymentTypeLabelKey.BONUS)}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t(paymentTypeLabelKey.EZAM_ELAVE)}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("paymentsTotal")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("paymentsPaidTotal")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentByEmployee.map((group) => {
                          const isExpanded = expandedPaymentEmployees.has(group.employeeId);
                          const toggle = () =>
                            setExpandedPaymentEmployees((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.employeeId)) next.delete(group.employeeId);
                              else next.add(group.employeeId);
                              return next;
                            });
                          return (
                            <Fragment key={group.employeeId}>
                              <tr
                                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                                key={`group-${group.employeeId}`}
                                onClick={toggle}
                              >
                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                  <span className="inline-flex items-center gap-1.5">
                                    {group.sessions.length > 1 ? (
                                      isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                                    ) : (
                                      <span className="w-[14px]" />
                                    )}
                                    {group.employeeName}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.sessions.length}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.byType.BONUS > 0 ? `₼${group.byType.BONUS}` : "–"}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.byType.EZAM_ELAVE > 0 ? `₼${group.byType.EZAM_ELAVE}` : "–"}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-purple-700">₼{group.totalAmount}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">₼{group.totalPaid}</td>
                              </tr>
                              {isExpanded && group.sessions.map((s) => (
                                <tr className="border-t border-slate-50 bg-slate-50/60" key={`session-${s.id}`}>
                                  <td className="py-2 pl-10 pr-4 text-slate-500" colSpan={2}>{s.date}</td>
                                  <td className="px-4 py-2 text-right text-slate-500" colSpan={2}>{t(paymentTypeLabelKey[s.type])}</td>
                                  <td className="px-4 py-2 text-right text-purple-600">₼{s.amount}</td>
                                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-purple-500">₼</span>
                                      <input
                                        className={`w-16 rounded border px-1.5 py-0.5 text-right text-xs font-semibold focus:outline-none ${
                                          s.paid >= s.amount
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                            : s.paid > 0
                                              ? "border-amber-300 bg-amber-50 text-amber-800"
                                              : "border-slate-300 bg-white text-slate-700"
                                        }`}
                                        defaultValue={s.paid}
                                        key={`${s.id}-${s.paid}`}
                                        min={0}
                                        onBlur={(e) => void updatePaymentPaid(s.id, s.paid, Number(e.target.value))}
                                        type="number"
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                        <tr>
                          <td className="px-4 py-2.5 font-semibold text-slate-900" colSpan={2}>{t("total")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-purple-900">₼{paymentTotalsByType.BONUS}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-purple-900">₼{paymentTotalsByType.EZAM_ELAVE}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-purple-900">₼{totalPaymentAmount}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-900">₼{totalPaymentPaid}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Employee Debt (Avans) section */}
            {avansRecords.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-3">
                {/* Summary + given/repaid split */}
                <div className="flex flex-col gap-4 rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-rose-700">
                    <Banknote size={20} />
                    <h2 className="font-semibold">{t("employeeDebt")}</h2>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-rose-900">₼{totalAvansOutstanding}</div>
                    <div className="mt-1 text-sm text-rose-600">
                      {t("avansOutstanding")} · {avansRecords.length} {t("records")}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-white/60 p-3 text-center">
                      <div className="text-xs font-semibold text-slate-500">{t("avansGiven")}</div>
                      <div className="mt-1 text-xl font-bold text-slate-800">₼{totalAvansGiven}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                      <div className="text-xs font-semibold text-emerald-600">{t("avansRepaid")}</div>
                      <div className="mt-1 text-xl font-bold text-emerald-800">₼{totalAvansRepaid}</div>
                    </div>
                  </div>
                </div>

                {/* Per-employee debt table */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                  <h2 className="font-semibold text-slate-950">{t("byEmployee")}</h2>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("employee")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("records")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("avansGiven")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("avansRepaid")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("avansOutstanding")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {avansByEmployee.map((group) => {
                          const isExpanded = expandedAvansEmployees.has(group.employeeId);
                          const toggle = () =>
                            setExpandedAvansEmployees((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.employeeId)) next.delete(group.employeeId);
                              else next.add(group.employeeId);
                              return next;
                            });
                          return (
                            <Fragment key={group.employeeId}>
                              <tr
                                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                                key={`group-${group.employeeId}`}
                                onClick={toggle}
                              >
                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                  <span className="inline-flex items-center gap-1.5">
                                    {group.sessions.length > 1 ? (
                                      isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                                    ) : (
                                      <span className="w-[14px]" />
                                    )}
                                    {group.employeeName}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.sessions.length}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">₼{group.totalGiven}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">₼{group.totalRepaid}</td>
                                <td className={`px-4 py-2.5 text-right font-semibold ${group.totalOutstanding > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                  ₼{group.totalOutstanding}
                                </td>
                              </tr>
                              {isExpanded && group.sessions.map((s) => (
                                <tr className="border-t border-slate-50 bg-slate-50/60" key={`session-${s.id}`}>
                                  <td className="py-2 pl-10 pr-4 text-slate-500" colSpan={2}>{s.date}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">₼{s.given}</td>
                                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-emerald-500">₼</span>
                                      <input
                                        className={`w-16 rounded border px-1.5 py-0.5 text-right text-xs font-semibold focus:outline-none ${
                                          s.repaid >= s.given
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                            : s.repaid > 0
                                              ? "border-amber-300 bg-amber-50 text-amber-800"
                                              : "border-rose-300 bg-rose-50 text-rose-800"
                                        }`}
                                        defaultValue={s.repaid}
                                        key={`${s.id}-${s.repaid}`}
                                        min={0}
                                        onBlur={(e) => void updatePaymentPaid(s.id, s.repaid, Number(e.target.value))}
                                        type="number"
                                      />
                                    </div>
                                  </td>
                                  <td className={`px-4 py-2 text-right font-semibold ${s.outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                    ₼{s.outstanding}
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                        <tr>
                          <td className="px-4 py-2.5 font-semibold text-slate-900" colSpan={2}>{t("total")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">₼{totalAvansGiven}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-900">₼{totalAvansRepaid}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${totalAvansOutstanding > 0 ? "text-rose-900" : "text-emerald-900"}`}>
                            ₼{totalAvansOutstanding}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Expenses section — company spending routed through an employee, not debt */}
            {expenseRecords.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-3">
                <div className="flex flex-col gap-4 rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Banknote size={20} />
                    <h2 className="font-semibold">{t("expenses")}</h2>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-orange-900">₼{totalExpenseAmount}</div>
                    <div className="mt-1 text-sm text-orange-600">
                      {expenseRecords.length} {t("records")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-white/60 p-3">
                    <div className="space-y-2">
                      {expenseTypeValues.map((type) => (
                        <div key={type} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-orange-800">{t(expenseTypeLabelKey[type])}</span>
                          <span className="text-sm font-semibold text-orange-900">₼{expenseTotalsByType[type]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                  <h2 className="font-semibold text-slate-950">{t("byEmployee")}</h2>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("employee")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("records")}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t(expenseTypeLabelKey.FOOD)}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t(expenseTypeLabelKey.TOOL)}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t(expenseTypeLabelKey.FINE)}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t(expenseTypeLabelKey.OTHER)}</th>
                          <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("expensesTotal")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseByEmployee.map((group) => {
                          const isExpanded = expandedExpenseEmployees.has(group.employeeId);
                          const toggle = () =>
                            setExpandedExpenseEmployees((prev) => {
                              const next = new Set(prev);
                              if (next.has(group.employeeId)) next.delete(group.employeeId);
                              else next.add(group.employeeId);
                              return next;
                            });
                          return (
                            <Fragment key={group.employeeId}>
                              <tr
                                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                                key={`group-${group.employeeId}`}
                                onClick={toggle}
                              >
                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                  <span className="inline-flex items-center gap-1.5">
                                    {group.sessions.length > 1 ? (
                                      isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                                    ) : (
                                      <span className="w-[14px]" />
                                    )}
                                    {group.employeeName}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.sessions.length}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.byType.FOOD > 0 ? `₼${group.byType.FOOD}` : "–"}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.byType.TOOL > 0 ? `₼${group.byType.TOOL}` : "–"}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.byType.FINE > 0 ? `₼${group.byType.FINE}` : "–"}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{group.byType.OTHER > 0 ? `₼${group.byType.OTHER}` : "–"}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-orange-700">₼{group.totalAmount}</td>
                              </tr>
                              {isExpanded && group.sessions.map((s) => (
                                <tr className="border-t border-slate-50 bg-slate-50/60" key={`session-${s.id}`}>
                                  <td className="py-2 pl-10 pr-4 text-slate-500" colSpan={2}>{s.date}</td>
                                  <td className="px-4 py-2 text-right text-slate-500" colSpan={4}>{t(expenseTypeLabelKey[s.type])}</td>
                                  <td className="px-4 py-2 text-right text-orange-600">₼{s.amount}</td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                        <tr>
                          <td className="px-4 py-2.5 font-semibold text-slate-900" colSpan={2}>{t("total")}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-orange-900">₼{expenseTotalsByType.FOOD}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-orange-900">₼{expenseTotalsByType.TOOL}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-orange-900">₼{expenseTotalsByType.FINE}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-orange-900">₼{expenseTotalsByType.OTHER}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-orange-900">₼{totalExpenseAmount}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* By Employee & By Location tables */}
            <section className="grid gap-4 xl:grid-cols-2">
              <BreakdownTable
                emptyText="No employee rows"
                headers={[
                  t("employee"),
                  t("department"),
                  t("records"),
                  t("statusISDE"),
                  t("statusEZAMIYYET"),
                  t("other"),
                  t("weekend"),
                  t("holiday"),
                  t("cars"),
                  `🍽 1 (×₼${prices.tier1})`,
                  `🍽 2 (×₼${prices.tier2})`,
                  `🍽 3 (×₼${prices.tier3})`,
                  `🍽 4 (×₼${prices.tier4})`,
                  `🍽 5+ (×₼${prices.tier5plus})`,
                  t("cateringCost"),
                  t("cateringPaid"),
                  t("cateringUnpaid"),
                  t(paymentTypeLabelKey.BONUS),
                  t(paymentTypeLabelKey.EZAM_ELAVE),
                  t("paymentsTotal"),
                  t("paymentsPaidTotal"),
                  t("avansGiven"),
                  t("avansRepaid"),
                  t("avansOutstanding"),
                  t(expenseTypeLabelKey.FOOD),
                  t(expenseTypeLabelKey.TOOL),
                  t(expenseTypeLabelKey.FINE),
                  t(expenseTypeLabelKey.OTHER),
                  t("expensesTotal"),
                  t("statusMEZUNIYYET"),
                  t("statusXESTE"),
                ]}
                rows={byEmployee.map((item) => {
                  const otherCount = item.records - item.isdeDays - item.ezamiyyetDays;
                  const emp = employees.find((e) => e.id === item.employeeId);
                  const vacDays = item.statusCounts.MEZUNIYYET;
                  const sickDays = item.statusCounts.XESTE;
                  const vacStr = emp?.vacationLimit != null ? `${vacDays} / ${emp.vacationLimit}` : vacDays > 0 ? `${vacDays}` : "-";
                  const sickStr = emp?.sickLimit != null ? `${sickDays} / ${emp.sickLimit}` : sickDays > 0 ? `${sickDays}` : "-";
                  return [
                    item.employeeName,
                    item.department,
                    item.records,
                    item.isdeDays,
                    item.ezamiyyetDays,
                    otherCount,
                    item.weekendWorkedDays,
                    item.holidayWorkedDays,
                    item.carsDrivenDays,
                    item.cookedTier1 || "-",
                    item.cookedTier2 || "-",
                    item.cookedTier3 || "-",
                    item.cookedTier4 || "-",
                    item.cookedTier5plus || "-",
                    item.cateringCost > 0 ? `₼${item.cateringCost}` : "-",
                    item.cookedPaidDays > 0 ? `${item.cookedPaidDays} day(s)` : "-",
                    item.cookedUnpaidDays > 0 ? `${item.cookedUnpaidDays} day(s)` : "-",
                    item.paymentBonusTotal > 0 ? `₼${item.paymentBonusTotal}` : "-",
                    item.paymentEzamElaveTotal > 0 ? `₼${item.paymentEzamElaveTotal}` : "-",
                    item.paymentTotal > 0 ? `₼${item.paymentTotal}` : "-",
                    item.paymentPaidTotal > 0 ? `₼${item.paymentPaidTotal}` : "-",
                    item.avansGivenTotal > 0 ? `₼${item.avansGivenTotal}` : "-",
                    item.avansRepaidTotal > 0 ? `₼${item.avansRepaidTotal}` : "-",
                    item.avansOutstandingTotal > 0 ? `₼${item.avansOutstandingTotal}` : "-",
                    item.expenseFoodTotal > 0 ? `₼${item.expenseFoodTotal}` : "-",
                    item.expenseToolTotal > 0 ? `₼${item.expenseToolTotal}` : "-",
                    item.expenseFineTotal > 0 ? `₼${item.expenseFineTotal}` : "-",
                    item.expenseOtherTotal > 0 ? `₼${item.expenseOtherTotal}` : "-",
                    item.expenseTotal > 0 ? `₼${item.expenseTotal}` : "-",
                    vacStr,
                    sickStr,
                  ];
                })}
                title={t("byEmployee")}
              />
              <BreakdownTable
                emptyText="No location rows"
                headers={[
                  t("location"),
                  t("records"),
                  t("uniqueDays"),
                  t("employees"),
                  t("statusISDE"),
                  t("statusEZAMIYYET"),
                  t("cars"),
                ]}
                rows={byLocation.map((item) => [
                  item.location,
                  item.records,
                  item.uniqueDays,
                  item.uniqueEmployees,
                  item.isdeDays,
                  item.ezamiyyetDays,
                  item.carsDrivenDays,
                ])}
                title={t("byLocation")}
              />
            </section>

            {/* Detailed Records */}
            <BreakdownTable
              emptyText="No attendance records match these filters"
              headers={[
                t("date"),
                t("employee"),
                t("department"),
                t("status"),
                t("location"),
                t("workLocations"),
                t("cars"),
                t("note"),
                t("formSubmission"),
                t("weekend"),
                t("holiday"),
              ]}
              rows={rows.map((row) => [
                row.date,
                row.employeeName,
                row.department,
                t(statusKey(row.status)),
                row.location ?? "-",
                row.workLocations.join(", ") || "-",
                row.carDriven ? (row.car ?? "Yes") : "-",
                row.note ?? "-",
                formNoteByCell.get(`${row.employeeId}:${row.date}`) ?? "-",
                row.isWeekend ? "Yes" : "No",
                row.holidayDescription ?? (row.isHoliday ? "Yes" : "No"),
              ])}
              title={t("records")}
            />
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400 shadow-sm">
            Run a report to see attendance records.
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ---- Sub-components ----

function MetricCard({
  color = "slate",
  icon,
  label,
  value,
}: {
  color?: "slate" | "green" | "blue" | "teal";
  icon?: ReactNode;
  label: string;
  value: string | number;
}) {
  const colorMap = {
    slate: { bg: "bg-white", border: "border-slate-200", text: "text-slate-950", label: "text-slate-500" },
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900", label: "text-green-600" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", label: "text-blue-600" },
    teal: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900", label: "text-teal-600" },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 shadow-sm`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${c.label}`}>
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${c.text}`}>{value}</div>
    </div>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select
        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function DateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <input
        className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        onChange={(e) => onChange(e.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function EmployeeReportModal({
  employeeId,
  employees,
  error,
  from,
  loading,
  onClose,
  onEmployeeIdChange,
  onFromChange,
  onGenerate,
  onToChange,
  t,
  to,
}: {
  employeeId: string;
  employees: Employee[];
  error: string;
  from: string;
  loading: boolean;
  onClose: () => void;
  onEmployeeIdChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onGenerate: () => void;
  onToChange: (value: string) => void;
  t: (key: string) => string;
  to: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
      <div className="flex max-h-full w-full max-w-sm flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-950">{t("employeeReport")}</h2>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            title={t("close")}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto px-4 py-4">
          <SelectField label={t("employee")} onChange={onEmployeeIdChange} value={employeeId}>
            <option value="">{t("allEmployees")}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} – {emp.department}
              </option>
            ))}
          </SelectField>
          <DateField label={t("from")} onChange={onFromChange} value={from} />
          <DateField label={t("to")} onChange={onToChange} value={to} />
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={onGenerate}
            type="button"
          >
            <FileSpreadsheet size={16} />
            {loading ? "…" : t("generateReport")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BreakdownTable({
  emptyText,
  headers,
  rows,
  title,
}: {
  emptyText: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              {headers.map((header) => (
                <th className="px-4 py-3 font-semibold text-slate-600" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-400"
                  colSpan={headers.length}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr className="border-b border-slate-100 hover:bg-slate-50" key={`${title}-${ri}`}>
                  {row.map((cell, ci) => (
                    <td
                      className="whitespace-pre-line px-4 py-3 text-slate-700"
                      key={`${title}-${ri}-${ci}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- Helpers ----

function employeeLabel(employees: Employee[], empId: string) {
  const emp = employees.find((e) => e.id.toString() === empId);
  return emp ? `${emp.name} – ${emp.department}` : "";
}

function carLabel(cars: CarType[], cId: string) {
  const c = cars.find((car) => car.id.toString() === cId);
  return c ? `${c.makeModel} – ${c.licensePlate}` : "";
}

function optionLabel(value: string) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "All";
}

function exportRows(
  rows: FilteredReportRow[],
  t: (key: string) => string,
  formNoteByCell: Map<string, string> = new Map(),
) {
  return rows.map((row) => ({
    Date: row.date,
    Employee: row.employeeName,
    Department: row.department,
    Status: t(statusKey(row.status)),
    Location: row.location ?? "",
    "Work Locations": row.workLocations.join(", "),
    Car: row.carDriven ? (row.car ?? "Yes") : "",
    Note: row.note ?? "",
    "Form Submission": formNoteByCell.get(`${row.employeeId}:${row.date}`) ?? "",
    Payment: row.paymentType ? t(paymentTypeLabelKey[row.paymentType]) : "",
    "Payment Amount (₼)": row.paymentAmount ?? "",
    "Payment Paid (₼)": row.paymentPaid ?? "",
    Expense: row.expenseType ? t(expenseTypeLabelKey[row.expenseType]) : "",
    "Expense Amount (₼)": row.expenseAmount ?? "",
    Weekend: row.isWeekend ? "Yes" : "No",
    Holiday: row.holidayDescription ?? (row.isHoliday ? "Yes" : "No"),
  }));
}

// ---- Excel export: styling ----

type SectionAccent = "general" | "catering" | "payments" | "debt" | "expense";

const ACCENT_FILL: Record<SectionAccent, Fill> = {
  general: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } }, // slate-800
  catering: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }, // teal-700
  payments: { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } }, // violet-700
  debt: { type: "pattern", pattern: "solid", fgColor: { argb: "FFBE123C" } }, // rose-700
  expense: { type: "pattern", pattern: "solid", fgColor: { argb: "FFC2410C" } }, // orange-700
};

const BAND_FILL: Record<SectionAccent, Fill> = {
  general: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }, // slate-100
  catering: { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } }, // teal-100
  payments: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } }, // violet-100
  debt: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } }, // rose-100
  expense: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDD5" } }, // orange-100
};

const ZEBRA_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
const HEADER_FONT: Partial<Font> = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
const TITLE_FONT: Partial<Font> = { color: { argb: "FF0F172A" }, bold: true, size: 16 };
const SUBTITLE_FONT: Partial<Font> = { color: { argb: "FF64748B" }, italic: true, size: 10 };
const SECTION_FONT: Partial<Font> = { color: { argb: "FF0F172A" }, bold: true, size: 11 };
const THIN: Partial<Border> = { style: "thin", color: { argb: "FFE2E8F0" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const CENTER: Partial<Alignment> = { vertical: "middle", horizontal: "center", wrapText: true };
const MONEY_FMT = '"₼"#,##0.00';
const DATE_FMT = "yyyy-mm-dd";

function styleHeaderRow(row: Row, accent: SectionAccent = "general") {
  row.eachCell((cell) => {
    cell.fill = ACCENT_FILL[accent];
    cell.font = HEADER_FONT;
    cell.alignment = CENTER;
    cell.border = BORDER;
  });
  row.height = 22;
}

function styleDataRow(row: Row, zebra: boolean) {
  row.eachCell((cell) => {
    cell.border = BORDER;
    if (zebra) cell.fill = ZEBRA_FILL;
  });
}

function autoWidth(ws: Worksheet, colCount: number, min = 10, max = 40) {
  for (let i = 1; i <= colCount; i++) {
    const col = ws.getColumn(i);
    let w = min;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > w) w = len;
    });
    col.width = Math.min(max, w + 2);
  }
}

type ColumnDef = { header: string; key: string; type?: "money" | "date" };

// Writes a header row + data rows starting at `startRow`. Returns the last row written.
function addTable(
  ws: Worksheet,
  columns: ColumnDef[],
  rows: Array<Record<string, unknown>>,
  accent: SectionAccent,
  startRow: number,
  applyFilter = true,
) {
  const headerRow = ws.getRow(startRow);
  columns.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
  });
  styleHeaderRow(headerRow, accent);

  rows.forEach((r, i) => {
    const row = ws.getRow(startRow + 1 + i);
    columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const raw = r[c.key];
      if (c.type === "date" && typeof raw === "string" && raw) {
        // exceljs serializes Date via getTime() (UTC), so a local-midnight Date
        // would shift a day in any non-UTC timezone. Noon UTC keeps the floor'd
        // Excel serial date pinned to the intended calendar day everywhere.
        cell.value = parseCalendarDate(raw);
        cell.numFmt = DATE_FMT;
      } else {
        cell.value = raw as CellValue;
        if (c.type === "money") cell.numFmt = MONEY_FMT;
      }
    });
    styleDataRow(row, i % 2 === 1);
  });

  if (applyFilter) {
    ws.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow, column: columns.length } };
  }

  return startRow + rows.length;
}

// Title + subtitle banner used at the top of the Summary sheet.
function addTitleBanner(ws: Worksheet, title: string, subtitle: string, spanCols: number) {
  ws.mergeCells(1, 1, 1, spanCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, spanCols);
  const subtitleCell = ws.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = SUBTITLE_FONT;
  ws.getRow(2).height = 18;

  return 4; // next free row
}

// A labeled section of key/value pairs (two columns), with a colored band header.
function addKeyValueSection(
  ws: Worksheet,
  title: string,
  pairs: Array<[string, string | number]>,
  accent: SectionAccent,
  startRow: number,
) {
  ws.mergeCells(startRow, 1, startRow, 2);
  const bandCell = ws.getCell(startRow, 1);
  bandCell.value = title;
  bandCell.font = SECTION_FONT;
  bandCell.fill = BAND_FILL[accent];
  bandCell.alignment = { vertical: "middle" };
  ws.getRow(startRow).height = 20;
  ws.getRow(startRow).eachCell((cell) => { cell.border = BORDER; });

  pairs.forEach(([label, value], i) => {
    const row = ws.getRow(startRow + 1 + i);
    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: "FF334155" } };
    const valueCell = row.getCell(2);
    valueCell.value = value;
    styleDataRow(row, i % 2 === 1);
  });

  return startRow + 1 + pairs.length + 1; // +1 blank row after section
}

function buildSummarySheet(
  workbook: Workbook,
  args: {
    from: string;
    to: string;
    filters: Record<"employee" | "department" | "status" | "location" | "car" | "weekend" | "holiday", string>;
    summary: FilteredReport["summary"];
    catering: { total: number; paid: number; unpaid: number; days: number };
    payments: { total: number; paid: number; unpaid: number };
    debt: { given: number; repaid: number; outstanding: number };
    expense: { total: number };
    t: (key: string) => string;
  },
) {
  const ws = workbook.addWorksheet("Summary", { properties: { tabColor: { argb: "FF1E293B" } } });
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 30;

  let row = addTitleBanner(ws, "Attendance Report", `${args.from} – ${args.to}`, 2);

  row = addKeyValueSection(
    ws,
    "Filters",
    [
      ["Employee", args.filters.employee],
      ["Department", args.filters.department],
      ["Status", args.filters.status],
      ["Location", args.filters.location],
      ["Car", args.filters.car],
      ["Weekend", args.filters.weekend],
      ["Holiday", args.filters.holiday],
    ],
    "general",
    row,
  );

  row = addKeyValueSection(
    ws,
    "Attendance",
    [
      ["Total Records", args.summary.totalRecords],
      ["Unique Employees", args.summary.uniqueEmployees],
      ["İşdə Days", args.summary.isdeDays],
      ["Ezamiyyət Days", args.summary.ezamiyyetDays],
      ["Cars Driven Days", args.summary.carsDrivenDays],
      ["Weekend Worked", args.summary.weekendWorkedDays],
      ["Holiday Worked", args.summary.holidayWorkedDays],
      ["Unique Locations", args.summary.uniqueLocations],
    ],
    "general",
    row,
  );

  row = addKeyValueSection(
    ws,
    "Catering",
    [
      ["Total Cost (₼)", args.catering.total],
      ["Paid (₼)", args.catering.paid],
      ["Unpaid (₼)", args.catering.unpaid],
      ["Catering Days", args.catering.days],
    ],
    "catering",
    row,
  );

  row = addKeyValueSection(
    ws,
    "Payments (Bonus / Ezam əlavə)",
    [
      ["Total (₼)", args.payments.total],
      ["Paid (₼)", args.payments.paid],
      ["Unpaid (₼)", args.payments.unpaid],
    ],
    "payments",
    row,
  );

  row = addKeyValueSection(
    ws,
    "Employee Debt (Avans)",
    [
      ["Given (₼)", args.debt.given],
      ["Repaid (₼)", args.debt.repaid],
      ["Outstanding (₼)", args.debt.outstanding],
    ],
    "debt",
    row,
  );

  addKeyValueSection(
    ws,
    "Expenses (Food / Tool / Fine / Other — company spending)",
    [["Total (₼)", args.expense.total]],
    "expense",
    row,
  );
}

function buildByEmployeeSheet(
  workbook: Workbook,
  byEmployee: ReturnType<typeof groupByEmployee>,
  employees: Employee[],
  t: (key: string) => string,
) {
  const ws = workbook.addWorksheet("By Employee", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    properties: { tabColor: { argb: "FF1E293B" } },
  });

  const statusCols: ColumnDef[] = statusOptions.map((s) => ({ header: t(statusKey(s)), key: `status_${s}` }));
  const columns: ColumnDef[] = [
    { header: "Employee", key: "employee" },
    { header: "Department", key: "department" },
    { header: "Records", key: "records" },
    ...statusCols,
    { header: "Weekend Worked", key: "weekendWorked" },
    { header: "Holiday Worked", key: "holidayWorked" },
    { header: "Cars Driven", key: "carsDriven" },
    { header: "Vacation Used", key: "vacationUsed" },
    { header: "Vacation Limit", key: "vacationLimit" },
    { header: "Sick Used", key: "sickUsed" },
    { header: "Sick Limit", key: "sickLimit" },
  ];

  const rows = byEmployee.map((item) => {
    const emp = employees.find((e) => e.id === item.employeeId);
    const statusValues = Object.fromEntries(
      statusOptions.map((s) => [`status_${s}`, item.statusCounts[s]]),
    );
    return {
      employee: item.employeeName,
      department: item.department,
      records: item.records,
      ...statusValues,
      weekendWorked: item.weekendWorkedDays,
      holidayWorked: item.holidayWorkedDays,
      carsDriven: item.carsDrivenDays,
      vacationUsed: item.statusCounts.MEZUNIYYET,
      vacationLimit: emp?.vacationLimit ?? "",
      sickUsed: item.statusCounts.XESTE,
      sickLimit: emp?.sickLimit ?? "",
    };
  });

  addTable(ws, columns, rows, "general", 1);
  autoWidth(ws, columns.length);
  ws.getColumn(1).width = Math.max(ws.getColumn(1).width ?? 10, 20);
}

function buildCateringSheet(
  workbook: Workbook,
  cateringDays: Array<{ fullDate: string; cookedHeadcount: number; cost: number }>,
  cateringByEmployee: CookGroup[],
) {
  const ws = workbook.addWorksheet("Catering", { properties: { tabColor: { argb: "FF0F766E" } } });

  ws.getCell(1, 1).value = "Daily Cost";
  ws.getCell(1, 1).font = SECTION_FONT;
  ws.getRow(1).height = 20;

  const dailyRows = cateringDays.map((d) => ({ date: d.fullDate, headcount: d.cookedHeadcount, cost: d.cost }));
  let nextRow = addTable(
    ws,
    [
      { header: "Date", key: "date", type: "date" },
      { header: "Headcount", key: "headcount" },
      { header: "Cost (₼)", key: "cost", type: "money" },
    ],
    dailyRows,
    "catering",
    2,
  );

  nextRow += 2;
  ws.getCell(nextRow, 1).value = "By Employee";
  ws.getCell(nextRow, 1).font = SECTION_FONT;
  ws.getRow(nextRow).height = 20;
  nextRow += 1;

  const empRows = cateringByEmployee.map((g) => ({
    employee: g.employeeName,
    sessions: g.sessions.length,
    total: g.totalCost,
    paid: g.paidCost,
    unpaid: g.unpaidCost,
  }));
  addTable(
    ws,
    [
      { header: "Employee", key: "employee" },
      { header: "Sessions", key: "sessions" },
      { header: "Total Cost (₼)", key: "total", type: "money" },
      { header: "Paid (₼)", key: "paid", type: "money" },
      { header: "Unpaid (₼)", key: "unpaid", type: "money" },
    ],
    empRows,
    "catering",
    nextRow,
    false,
  );

  autoWidth(ws, 5);
}

function buildPaymentsSheet(workbook: Workbook, paymentByEmployee: PaymentGroup[], t: (key: string) => string) {
  const ws = workbook.addWorksheet("Payments", { properties: { tabColor: { argb: "FF6D28D9" } } });

  const rows = paymentByEmployee.map((g) => ({
    employee: g.employeeName,
    sessions: g.sessions.length,
    bonus: g.byType.BONUS,
    ezamElave: g.byType.EZAM_ELAVE,
    total: g.totalAmount,
    paid: g.totalPaid,
    unpaid: Math.max(0, g.totalAmount - g.totalPaid),
  }));

  addTable(
    ws,
    [
      { header: "Employee", key: "employee" },
      { header: "Sessions", key: "sessions" },
      { header: t(paymentTypeLabelKey.BONUS) + " (₼)", key: "bonus", type: "money" },
      { header: t(paymentTypeLabelKey.EZAM_ELAVE) + " (₼)", key: "ezamElave", type: "money" },
      { header: "Total (₼)", key: "total", type: "money" },
      { header: "Paid (₼)", key: "paid", type: "money" },
      { header: "Unpaid (₼)", key: "unpaid", type: "money" },
    ],
    rows,
    "payments",
    1,
  );

  autoWidth(ws, 7);
}

function buildExpensesSheet(workbook: Workbook, expenseByEmployee: ExpenseGroup[], t: (key: string) => string) {
  const ws = workbook.addWorksheet("Expenses", { properties: { tabColor: { argb: "FFC2410C" } } });

  const rows = expenseByEmployee.map((g) => ({
    employee: g.employeeName,
    sessions: g.sessions.length,
    food: g.byType.FOOD,
    tool: g.byType.TOOL,
    fine: g.byType.FINE,
    other: g.byType.OTHER,
    total: g.totalAmount,
  }));

  addTable(
    ws,
    [
      { header: "Employee", key: "employee" },
      { header: "Sessions", key: "sessions" },
      { header: t(expenseTypeLabelKey.FOOD) + " (₼)", key: "food", type: "money" },
      { header: t(expenseTypeLabelKey.TOOL) + " (₼)", key: "tool", type: "money" },
      { header: t(expenseTypeLabelKey.FINE) + " (₼)", key: "fine", type: "money" },
      { header: t(expenseTypeLabelKey.OTHER) + " (₼)", key: "other", type: "money" },
      { header: "Total (₼)", key: "total", type: "money" },
    ],
    rows,
    "expense",
    1,
  );

  autoWidth(ws, 7);
}

function buildDebtSheet(workbook: Workbook, avansByEmployee: AvansGroup[]) {
  const ws = workbook.addWorksheet("Employee Debt", { properties: { tabColor: { argb: "FFBE123C" } } });

  const rows = avansByEmployee.map((g) => ({
    employee: g.employeeName,
    sessions: g.sessions.length,
    given: g.totalGiven,
    repaid: g.totalRepaid,
    outstanding: g.totalOutstanding,
  }));

  addTable(
    ws,
    [
      { header: "Employee", key: "employee" },
      { header: "Sessions", key: "sessions" },
      { header: "Given (₼)", key: "given", type: "money" },
      { header: "Repaid (₼)", key: "repaid", type: "money" },
      { header: "Outstanding (₼)", key: "outstanding", type: "money" },
    ],
    rows,
    "debt",
    1,
  );

  autoWidth(ws, 5);
}

function buildByLocationSheet(
  workbook: Workbook,
  byLocation: ReturnType<typeof groupByLocation>,
  t: (key: string) => string,
) {
  const ws = workbook.addWorksheet("By Location", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
    properties: { tabColor: { argb: "FF1E293B" } },
  });

  const statusCols: ColumnDef[] = statusOptions.map((s) => ({ header: t(statusKey(s)), key: `status_${s}` }));
  const columns: ColumnDef[] = [
    { header: "Location", key: "location" },
    { header: "Records", key: "records" },
    { header: "Unique Days", key: "uniqueDays" },
    { header: "Unique Employees", key: "uniqueEmployees" },
    ...statusCols,
    { header: "Cars Driven", key: "carsDriven" },
  ];

  const rows = byLocation.map((item) => {
    const statusValues = Object.fromEntries(
      statusOptions.map((s) => [`status_${s}`, item.statusCounts[s]]),
    );
    return {
      location: item.location,
      records: item.records,
      uniqueDays: item.uniqueDays,
      uniqueEmployees: item.uniqueEmployees,
      ...statusValues,
      carsDriven: item.carsDrivenDays,
    };
  });

  addTable(ws, columns, rows, "general", 1);
  autoWidth(ws, columns.length);
}

function buildRecordsSheet(workbook: Workbook, rows: ReturnType<typeof exportRows>) {
  const ws = workbook.addWorksheet("Records", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    properties: { tabColor: { argb: "FF1E293B" } },
  });

  const columns: ColumnDef[] = [
    { header: "Date", key: "Date", type: "date" },
    { header: "Employee", key: "Employee" },
    { header: "Department", key: "Department" },
    { header: "Status", key: "Status" },
    { header: "Location", key: "Location" },
    { header: "Work Locations", key: "Work Locations" },
    { header: "Car", key: "Car" },
    { header: "Note", key: "Note" },
    { header: "Form Submission", key: "Form Submission" },
    { header: "Payment", key: "Payment" },
    { header: "Payment Amount (₼)", key: "Payment Amount (₼)", type: "money" },
    { header: "Payment Paid (₼)", key: "Payment Paid (₼)", type: "money" },
    { header: "Expense", key: "Expense" },
    { header: "Expense Amount (₼)", key: "Expense Amount (₼)", type: "money" },
    { header: "Weekend", key: "Weekend" },
    { header: "Holiday", key: "Holiday" },
  ];

  addTable(ws, columns, rows, "general", 1);
  autoWidth(ws, columns.length);
  ws.getColumn(2).width = Math.max(ws.getColumn(2).width ?? 10, 18);
}

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "employee";
}

function buildEmployeeReport(
  workbook: Workbook,
  args: {
    employee: Employee | null;
    from: string;
    to: string;
    rows: FilteredReportRow[];
    summary: FilteredReport["summary"];
    prices: Prices;
    formNoteByCell: Map<string, string>;
    t: (key: string) => string;
  },
) {
  const { employee, from, to, rows, summary, prices, formNoteByCell, t } = args;
  const employeeName = employee?.name ?? "—";

  const cateringRows = rows
    .filter((r) => r.cookedHeadcount != null && r.cookedHeadcount > 0)
    .map((r) => ({ ...r, cost: cateringCostForHeadcount(r.cookedHeadcount!, prices) }));
  const cateringTotal = cateringRows.reduce((s, r) => s + r.cost, 0);
  const cateringPaid = cateringRows.filter((r) => r.cookedPaid).reduce((s, r) => s + r.cost, 0);
  const cateringUnpaid = cateringTotal - cateringPaid;

  const paymentRows = rows
    .filter((r) => (r.paymentType === "BONUS" || r.paymentType === "EZAM_ELAVE") && r.paymentAmount != null)
    .map((r) => ({ ...r, amount: r.paymentAmount as number, paid: r.paymentPaid ?? 0 }));
  const paymentTotal = paymentRows.reduce((s, r) => s + r.amount, 0);
  const paymentPaidTotal = paymentRows.reduce((s, r) => s + r.paid, 0);
  const paymentUnpaid = Math.max(0, paymentTotal - paymentPaidTotal);

  const avansRows = rows
    .filter((r) => r.paymentType === "AVANS" && r.paymentAmount != null)
    .map((r) => ({ ...r, given: r.paymentAmount as number, repaid: r.paymentPaid ?? 0 }));
  const avansGivenTotal = avansRows.reduce((s, r) => s + r.given, 0);
  const avansRepaidTotal = avansRows.reduce((s, r) => s + r.repaid, 0);
  const avansOutstandingTotal = Math.max(0, avansGivenTotal - avansRepaidTotal);

  const expenseRows = rows
    .filter((r) => r.expenseType != null && r.expenseAmount != null)
    .map((r) => ({ ...r, type: r.expenseType as ExpenseType, amount: r.expenseAmount as number }));
  const expenseTotal = expenseRows.reduce((s, r) => s + r.amount, 0);

  // ---- Profile sheet ----
  const profile = workbook.addWorksheet("Profile", { properties: { tabColor: { argb: "FF1E293B" } } });
  profile.getColumn(1).width = 26;
  profile.getColumn(2).width = 30;

  let row = addTitleBanner(profile, employeeName, `${from} – ${to}`, 2);

  row = addKeyValueSection(
    profile,
    "Employee",
    [
      ["Name", employeeName],
      ["Department", employee?.department ?? "—"],
      ["Vacation Limit", employee?.vacationLimit ?? "—"],
      ["Sick Limit", employee?.sickLimit ?? "—"],
    ],
    "general",
    row,
  );

  row = addKeyValueSection(
    profile,
    "Attendance",
    [
      ["Total Records", summary.totalRecords],
      ["İşdə Days", summary.isdeDays],
      ["Ezamiyyət Days", summary.ezamiyyetDays],
      ["Cars Driven Days", summary.carsDrivenDays],
      ["Weekend Worked", summary.weekendWorkedDays],
      ["Holiday Worked", summary.holidayWorkedDays],
    ],
    "general",
    row,
  );

  row = addKeyValueSection(
    profile,
    "Catering",
    [
      ["Total Cost (₼)", cateringTotal],
      ["Paid (₼)", cateringPaid],
      ["Unpaid (₼)", cateringUnpaid],
      ["Sessions", cateringRows.length],
    ],
    "catering",
    row,
  );

  row = addKeyValueSection(
    profile,
    "Payments (Bonus / Ezam əlavə)",
    [
      ["Total (₼)", paymentTotal],
      ["Paid (₼)", paymentPaidTotal],
      ["Unpaid (₼)", paymentUnpaid],
    ],
    "payments",
    row,
  );

  row = addKeyValueSection(
    profile,
    "Employee Debt (Avans)",
    [
      ["Given (₼)", avansGivenTotal],
      ["Repaid (₼)", avansRepaidTotal],
      ["Outstanding (₼)", avansOutstandingTotal],
    ],
    "debt",
    row,
  );

  addKeyValueSection(
    profile,
    "Expenses (Food / Tool / Fine / Other)",
    [
      ["Total (₼)", expenseTotal],
      ["Sessions", expenseRows.length],
    ],
    "expense",
    row,
  );

  // ---- Records sheet (full daily detail) ----
  buildRecordsSheet(workbook, exportRows(rows, t, formNoteByCell));

  // ---- Catering sheet ----
  if (cateringRows.length > 0) {
    const ws = workbook.addWorksheet("Catering", { properties: { tabColor: { argb: "FF0F766E" } } });
    const dataRows = cateringRows.map((r) => ({
      date: r.date,
      headcount: r.cookedHeadcount,
      cost: r.cost,
      paid: r.cookedPaid ? r.cost : 0,
      unpaid: r.cookedPaid ? 0 : r.cost,
    }));
    addTable(
      ws,
      [
        { header: "Date", key: "date", type: "date" },
        { header: "Headcount", key: "headcount" },
        { header: "Cost (₼)", key: "cost", type: "money" },
        { header: "Paid (₼)", key: "paid", type: "money" },
        { header: "Unpaid (₼)", key: "unpaid", type: "money" },
      ],
      dataRows,
      "catering",
      1,
    );
    autoWidth(ws, 5);
  }

  // ---- Payments sheet ----
  if (paymentRows.length > 0) {
    const ws = workbook.addWorksheet("Payments", { properties: { tabColor: { argb: "FF6D28D9" } } });
    const dataRows = paymentRows.map((r) => ({
      date: r.date,
      type: t(paymentTypeLabelKey[r.paymentType as "BONUS" | "EZAM_ELAVE"]),
      amount: r.amount,
      paid: r.paid,
      unpaid: Math.max(0, r.amount - r.paid),
    }));
    addTable(
      ws,
      [
        { header: "Date", key: "date", type: "date" },
        { header: "Type", key: "type" },
        { header: "Amount (₼)", key: "amount", type: "money" },
        { header: "Paid (₼)", key: "paid", type: "money" },
        { header: "Unpaid (₼)", key: "unpaid", type: "money" },
      ],
      dataRows,
      "payments",
      1,
    );
    autoWidth(ws, 5);
  }

  // ---- Employee Debt sheet (chronological running balance) ----
  if (avansRows.length > 0) {
    const ws = workbook.addWorksheet("Employee Debt", { properties: { tabColor: { argb: "FFBE123C" } } });
    let running = 0;
    const dataRows = avansRows.map((r) => {
      running = Math.max(0, running + r.given - r.repaid);
      return { date: r.date, given: r.given, repaid: r.repaid, outstanding: running };
    });
    addTable(
      ws,
      [
        { header: "Date", key: "date", type: "date" },
        { header: "Given (₼)", key: "given", type: "money" },
        { header: "Repaid (₼)", key: "repaid", type: "money" },
        { header: "Running Outstanding (₼)", key: "outstanding", type: "money" },
      ],
      dataRows,
      "debt",
      1,
    );
    autoWidth(ws, 4);
  }

  // ---- Expenses sheet ----
  if (expenseRows.length > 0) {
    const ws = workbook.addWorksheet("Expenses", { properties: { tabColor: { argb: "FFC2410C" } } });
    const dataRows = expenseRows.map((r) => ({
      date: r.date,
      type: t(expenseTypeLabelKey[r.type]),
      amount: r.amount,
    }));
    addTable(
      ws,
      [
        { header: "Date", key: "date", type: "date" },
        { header: "Type", key: "type" },
        { header: "Amount (₼)", key: "amount", type: "money" },
      ],
      dataRows,
      "expense",
      1,
    );
    autoWidth(ws, 3);
  }
}

function emptyStatusCounts() {
  return Object.fromEntries(statusOptions.map((s) => [s, 0])) as Record<AttendanceStatus, number>;
}

function groupByEmployee(rows: FilteredReportRow[], prices: Prices) {
  const grouped = new Map<
    number,
    {
      employeeId: number;
      employeeName: string;
      department: string;
      records: number;
      statusCounts: Record<AttendanceStatus, number>;
      isdeDays: number;
      ezamiyyetDays: number;
      weekendWorkedDays: number;
      holidayWorkedDays: number;
      carsDrivenDays: number;
      cookedTier1: number;
      cookedTier2: number;
      cookedTier3: number;
      cookedTier4: number;
      cookedTier5plus: number;
      cookedPaidDays: number;
      cookedUnpaidDays: number;
      paymentBonusTotal: number;
      paymentEzamElaveTotal: number;
      paymentPaidTotal: number;
      avansGivenTotal: number;
      avansRepaidTotal: number;
      expenseFoodTotal: number;
      expenseToolTotal: number;
      expenseFineTotal: number;
      expenseOtherTotal: number;
    }
  >();

  for (const row of rows) {
    const item = grouped.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      department: row.department,
      records: 0,
      statusCounts: emptyStatusCounts(),
      isdeDays: 0,
      ezamiyyetDays: 0,
      weekendWorkedDays: 0,
      holidayWorkedDays: 0,
      carsDrivenDays: 0,
      cookedTier1: 0,
      cookedTier2: 0,
      cookedTier3: 0,
      cookedTier4: 0,
      cookedTier5plus: 0,
      cookedPaidDays: 0,
      cookedUnpaidDays: 0,
      paymentBonusTotal: 0,
      paymentEzamElaveTotal: 0,
      paymentPaidTotal: 0,
      avansGivenTotal: 0,
      avansRepaidTotal: 0,
      expenseFoodTotal: 0,
      expenseToolTotal: 0,
      expenseFineTotal: 0,
      expenseOtherTotal: 0,
    };

    item.records += 1;
    item.statusCounts[row.status] += 1;
    item.isdeDays += row.status === "ISDE" ? 1 : 0;
    item.ezamiyyetDays += row.status === "EZAMIYYET" ? 1 : 0;
    item.weekendWorkedDays += row.isWeekend && isWorked(row.status) ? 1 : 0;
    item.holidayWorkedDays += row.isHoliday && isWorked(row.status) ? 1 : 0;
    item.carsDrivenDays += row.carDriven ? 1 : 0;
    if (row.cookedHeadcount === 1) item.cookedTier1 += 1;
    else if (row.cookedHeadcount === 2) item.cookedTier2 += 1;
    else if (row.cookedHeadcount === 3) item.cookedTier3 += 1;
    else if (row.cookedHeadcount === 4) item.cookedTier4 += 1;
    else if (row.cookedHeadcount != null && row.cookedHeadcount >= 5) item.cookedTier5plus += 1;
    if (row.cookedHeadcount != null && row.cookedHeadcount > 0) {
      if (row.cookedPaid) item.cookedPaidDays += 1;
      else item.cookedUnpaidDays += 1;
    }
    if (row.paymentType === "BONUS" && row.paymentAmount != null) {
      item.paymentBonusTotal += row.paymentAmount;
      item.paymentPaidTotal += row.paymentPaid ?? 0;
    } else if (row.paymentType === "EZAM_ELAVE" && row.paymentAmount != null) {
      item.paymentEzamElaveTotal += row.paymentAmount;
      item.paymentPaidTotal += row.paymentPaid ?? 0;
    } else if (row.paymentType === "AVANS" && row.paymentAmount != null) {
      item.avansGivenTotal += row.paymentAmount;
      item.avansRepaidTotal += row.paymentPaid ?? 0;
    }
    if (row.expenseType != null && row.expenseAmount != null) {
      if (row.expenseType === "FOOD") item.expenseFoodTotal += row.expenseAmount;
      else if (row.expenseType === "TOOL") item.expenseToolTotal += row.expenseAmount;
      else if (row.expenseType === "FINE") item.expenseFineTotal += row.expenseAmount;
      else item.expenseOtherTotal += row.expenseAmount;
    }
    grouped.set(row.employeeId, item);
  }

  return Array.from(grouped.values()).map((item) => {
    const tierCost = (hc: number, count: number) => cateringCostForHeadcount(hc, prices) * count;
    const totalCost =
      tierCost(1, item.cookedTier1) +
      tierCost(2, item.cookedTier2) +
      tierCost(3, item.cookedTier3) +
      tierCost(4, item.cookedTier4) +
      tierCost(5, item.cookedTier5plus);
    const paymentTotal = item.paymentBonusTotal + item.paymentEzamElaveTotal;
    const avansOutstandingTotal = Math.max(0, item.avansGivenTotal - item.avansRepaidTotal);
    const expenseTotal =
      item.expenseFoodTotal + item.expenseToolTotal + item.expenseFineTotal + item.expenseOtherTotal;
    return { ...item, cateringCost: totalCost, paymentTotal, avansOutstandingTotal, expenseTotal };
  });
}

function groupByLocation(rows: FilteredReportRow[]) {
  const grouped = new Map<
    string,
    {
      location: string;
      records: number;
      dates: Set<string>;
      employees: Set<number>;
      statusCounts: Record<AttendanceStatus, number>;
      isdeDays: number;
      ezamiyyetDays: number;
      carsDrivenDays: number;
    }
  >();

  for (const row of rows) {
    const rowLocations = new Set([
      ...(row.location ? [row.location] : []),
      ...row.workLocations,
    ]);

    for (const loc of rowLocations) {
      const item = grouped.get(loc) ?? {
        location: loc,
        records: 0,
        dates: new Set<string>(),
        employees: new Set<number>(),
        statusCounts: emptyStatusCounts(),
        isdeDays: 0,
        ezamiyyetDays: 0,
        carsDrivenDays: 0,
      };

      item.records += 1;
      item.dates.add(row.date);
      item.employees.add(row.employeeId);
      item.statusCounts[row.status] += 1;
      item.isdeDays += row.status === "ISDE" ? 1 : 0;
      item.ezamiyyetDays += row.status === "EZAMIYYET" ? 1 : 0;
      item.carsDrivenDays += row.carDriven ? 1 : 0;
      grouped.set(loc, item);
    }
  }

  return Array.from(grouped.values()).map((item) => ({
    location: item.location,
    records: item.records,
    uniqueDays: item.dates.size,
    uniqueEmployees: item.employees.size,
    statusCounts: item.statusCounts,
    isdeDays: item.isdeDays,
    ezamiyyetDays: item.ezamiyyetDays,
    carsDrivenDays: item.carsDrivenDays,
  }));
}

function isWorked(status: AttendanceStatus) {
  return status === "ISDE" || status === "EZAMIYYET" || status === "ISDE_XESARET";
}
