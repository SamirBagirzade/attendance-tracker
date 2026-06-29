"use client";

import { Fragment, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Car, ChefHat, ChevronDown, ChevronRight, Download, Search, Users } from "lucide-react";
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
import { AppShell } from "@/components/AppShell";
import { statusKey, useLanguage } from "@/lib/i18n";
import type {
  AttendanceStatus,
  Car as CarType,
  Employee,
  FilteredReport,
  FilteredReportRow,
  Location,
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

  const [expandedCookEmployees, setExpandedCookEmployees] = useState<Set<number>>(new Set());

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
    if (!res.ok) updateRecord(recordId, { cookedPaid: currentPaid });
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

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReport();
  }

  async function downloadExcel() {
    if (!report) return;

    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["From", from],
        ["To", to],
        ["Employee", employeeLabel(employees, employeeId) || "All"],
        ["Department", department || "All"],
        ["Status", status ? t(statusKey(status)) : t("allStatuses")],
        ["Location", location || t("allLocations")],
        ["Car", carLabel(cars, carId) || t("allCars")],
        ["Weekend", optionLabel(weekend)],
        ["Holiday", optionLabel(holiday)],
        ["Total Records", report.summary.totalRecords],
        ["Unique Employees", report.summary.uniqueEmployees],
        ["İşdə Days", report.summary.isdeDays],
        ["Ezamiyyət Days", report.summary.ezamiyyetDays],
        ["Cars Driven Days", report.summary.carsDrivenDays],
        ["Weekend Worked", report.summary.weekendWorkedDays],
        ["Holiday Worked", report.summary.holidayWorkedDays],
        ["Total Catering Cost (₼)", totalCateringCost],
        ["Catering Days", cateringDays.length],
        ["Unique Locations", report.summary.uniqueLocations],
      ]),
      "Summary",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        cateringDays.map((d) => ({
          Date: d.fullDate,
          Headcount: d.cookedHeadcount,
          "Cost (₼)": d.cost,
        })),
      ),
      "Catering Cost",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        byEmployee.map((item) => {
          const emp = employees.find((e) => e.id === item.employeeId);
          return {
            Employee: item.employeeName,
            Department: item.department,
            Records: item.records,
            "İşdə": item.isdeDays,
            "Ezamiyyət": item.ezamiyyetDays,
            ...statusCountsForExport(item.statusCounts, t),
            "Weekend Worked": item.weekendWorkedDays,
            "Holiday Worked": item.holidayWorkedDays,
            "Cars Driven": item.carsDrivenDays,
            [`Cooked 1 person (×₼${prices.tier1})`]: item.cookedTier1 || 0,
            [`Cooked 2 people (×₼${prices.tier2})`]: item.cookedTier2 || 0,
            [`Cooked 3 people (×₼${prices.tier3})`]: item.cookedTier3 || 0,
            [`Cooked 4 people (×₼${prices.tier4})`]: item.cookedTier4 || 0,
            [`Cooked 5+ people (×₼${prices.tier5plus})`]: item.cookedTier5plus || 0,
            "Catering Cost (₼)": item.cateringCost,
            "Vacation Days (used)": item.statusCounts.MEZUNIYYET,
            "Vacation Limit": emp?.vacationLimit ?? "",
            "Sick Days (used)": item.statusCounts.XESTE,
            "Sick Day Limit": emp?.sickLimit ?? "",
          };
        }),
      ),
      "By Employee",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        byLocation.map((item) => ({
          Location: item.location,
          Records: item.records,
          "Unique Days": item.uniqueDays,
          "Unique Employees": item.uniqueEmployees,
          "İşdə": item.isdeDays,
          "Ezamiyyət": item.ezamiyyetDays,
          ...statusCountsForExport(item.statusCounts, t),
          "Cars Driven": item.carsDrivenDays,
        })),
      ),
      "By Location",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(exportRows(rows, t)),
      "Records",
    );

    XLSX.writeFile(workbook, `attendance_report_${from}_${to}.xlsx`);
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
          </div>
        </form>

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
                      className="px-4 py-3 text-slate-700"
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

function exportRows(rows: FilteredReportRow[], t: (key: string) => string) {
  return rows.map((row) => ({
    Date: row.date,
    Employee: row.employeeName,
    Department: row.department,
    Status: t(statusKey(row.status)),
    Location: row.location ?? "",
    "Work Locations": row.workLocations.join(", "),
    Car: row.carDriven ? (row.car ?? "Yes") : "",
    Note: row.note ?? "",
    Weekend: row.isWeekend ? "Yes" : "No",
    Holiday: row.holidayDescription ?? (row.isHoliday ? "Yes" : "No"),
  }));
}

function emptyStatusCounts() {
  return Object.fromEntries(statusOptions.map((s) => [s, 0])) as Record<AttendanceStatus, number>;
}

function statusCountsForExport(
  statusCounts: Record<AttendanceStatus, number>,
  t: (key: string) => string,
) {
  return Object.fromEntries(
    statusOptions.map((s) => [`Status – ${t(statusKey(s))}`, statusCounts[s]]),
  );
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
    return { ...item, cateringCost: totalCost };
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
