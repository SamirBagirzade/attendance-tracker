"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  endOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { AlertTriangle, TrendingUp, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { statusKey, useLanguage } from "@/lib/i18n";
import type { AttendanceStatus, Employee, FilteredReport } from "@/types/domain";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Preset = "week" | "month" | "30d" | "quarter" | "3m" | "custom";

function getRangeForPreset(p: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (p) {
    case "week":
      return {
        from: fmt(startOfWeek(today, { weekStartsOn: 1 })),
        to: fmt(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case "month":
      return { from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) };
    case "30d":
      return { from: fmt(subDays(today, 29)), to: fmt(today) };
    case "quarter":
      return { from: fmt(startOfQuarter(today)), to: fmt(endOfQuarter(today)) };
    case "3m":
      return {
        from: fmt(startOfMonth(subMonths(today, 2))),
        to: fmt(endOfMonth(today)),
      };
    default:
      return { from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EmpStat = {
  employeeId: number;
  employeeName: string;
  department: string;
  records: number;
  isdeDays: number;
  ezamiyyetDays: number;
  vacationDays: number;
  sickDays: number;
  rate: number;
};

type Alert = {
  name: string;
  dept: string;
  type: "vacation" | "sick" | "lowRate" | "zero";
  detail: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsV2Page() {
  const { t } = useLanguage();
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [dept, setDept] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [report, setReport] = useState<FilteredReport | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data: Employee[]) => setEmployees(data))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (dept) params.set("department", dept);
    try {
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) setReport(await res.json());
    } finally {
      setLoading(false);
    }
  }, [from, to, dept]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      const range = getRangeForPreset(p);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const rows = useMemo(() => report?.records ?? [], [report]);

  const depts = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees],
  );

  const empStats = useMemo<EmpStat[]>(() => {
    const map = new Map<number, EmpStat>();
    for (const r of rows) {
      const s = map.get(r.employeeId) ?? {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        department: r.department,
        records: 0,
        isdeDays: 0,
        ezamiyyetDays: 0,
        vacationDays: 0,
        sickDays: 0,
        rate: 0,
      };
      s.records++;
      if (r.status === "ISDE") s.isdeDays++;
      if (r.status === "EZAMIYYET") s.ezamiyyetDays++;
      if (r.status === "MEZUNIYYET") s.vacationDays++;
      if (r.status === "XESTE") s.sickDays++;
      map.set(r.employeeId, s);
    }
    for (const s of map.values()) {
      s.rate =
        s.records > 0
          ? Math.round(((s.isdeDays + s.ezamiyyetDays) / s.records) * 100)
          : 0;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName),
    );
  }, [rows]);

  const deptStats = useMemo(() => {
    const map = new Map<
      string,
      { dept: string; records: number; isde: number; ezamiyyet: number; other: number }
    >();
    for (const r of rows) {
      const d = map.get(r.department) ?? {
        dept: r.department,
        records: 0,
        isde: 0,
        ezamiyyet: 0,
        other: 0,
      };
      d.records++;
      if (r.status === "ISDE") d.isde++;
      else if (r.status === "EZAMIYYET") d.ezamiyyet++;
      else d.other++;
      map.set(r.department, d);
    }
    return Array.from(map.values())
      .map((d) => ({
        ...d,
        rate:
          d.records > 0
            ? Math.round(((d.isde + d.ezamiyyet) / d.records) * 100)
            : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [rows]);

  const trendData = useMemo(() => {
    const map = new Map<string, { isde: number; ezamiyyet: number; other: number }>();
    for (const r of rows) {
      const d = map.get(r.date) ?? { isde: 0, ezamiyyet: 0, other: 0 };
      if (r.status === "ISDE") d.isde++;
      else if (r.status === "EZAMIYYET") d.ezamiyyet++;
      else d.other++;
      map.set(r.date, d);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => {
        const total = d.isde + d.ezamiyyet + d.other;
        return {
          date: date.slice(5),
          rate: total > 0 ? Math.round(((d.isde + d.ezamiyyet) / total) * 100) : 0,
          total,
        };
      });
  }, [rows]);

  const dowData = useMemo(() => {
    const map = new Map<number, { isde: number; ezamiyyet: number; other: number }>();
    for (let i = 0; i <= 6; i++) map.set(i, { isde: 0, ezamiyyet: 0, other: 0 });
    for (const r of rows) {
      const dow = getDay(parseISO(r.date));
      const d = map.get(dow)!;
      if (r.status === "ISDE") d.isde++;
      else if (r.status === "EZAMIYYET") d.ezamiyyet++;
      else d.other++;
    }
    return [1, 2, 3, 4, 5, 6, 0].map((dow) => {
      const d = map.get(dow)!;
      const total = d.isde + d.ezamiyyet + d.other;
      return {
        day: DOW_LABELS[dow],
        rate: total > 0 ? Math.round(((d.isde + d.ezamiyyet) / total) * 100) : 0,
        total,
      };
    });
  }, [rows]);

  const heatDays = useMemo(() => {
    try {
      return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
    } catch {
      return [];
    }
  }, [from, to]);

  const recMap = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    for (const r of rows) m.set(`${r.employeeId}|${r.date}`, r.status);
    return m;
  }, [rows]);

  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    for (const s of empStats) {
      const emp = employees.find((e) => e.id === s.employeeId);
      if (s.records >= 5 && s.rate < 60) {
        result.push({
          name: s.employeeName,
          dept: s.department,
          type: "lowRate",
          detail: `${s.rate}% attendance rate`,
        });
      }
      if (s.records >= 5 && s.isdeDays === 0 && s.ezamiyyetDays === 0) {
        result.push({
          name: s.employeeName,
          dept: s.department,
          type: "zero",
          detail: `0 working days out of ${s.records} records`,
        });
      }
      if (emp?.vacationLimit && s.vacationDays / emp.vacationLimit >= 0.8) {
        result.push({
          name: s.employeeName,
          dept: s.department,
          type: "vacation",
          detail: `${s.vacationDays} / ${emp.vacationLimit} vacation days used`,
        });
      }
      if (emp?.sickLimit && s.sickDays / emp.sickLimit >= 0.8) {
        result.push({
          name: s.employeeName,
          dept: s.department,
          type: "sick",
          detail: `${s.sickDays} / ${emp.sickLimit} sick days used`,
        });
      }
    }
    return result;
  }, [empStats, employees]);

  const totalRecs = report?.summary.totalRecords ?? 0;
  const isdeDays = report?.summary.isdeDays ?? 0;
  const ezamiyyetDays = report?.summary.ezamiyyetDays ?? 0;
  const uniqueEmp = report?.summary.uniqueEmployees ?? 0;
  const overallRate =
    totalRecs > 0 ? Math.round(((isdeDays + ezamiyyetDays) / totalRecs) * 100) : 0;
  const absentDays = totalRecs - isdeDays - ezamiyyetDays;

  const ranked = useMemo(
    () =>
      [...empStats]
        .filter((s) => s.records >= 3)
        .sort((a, b) => b.rate - a.rate),
    [empStats],
  );

  // ─── Presets config ────────────────────────────────────────────────────────

  const PRESETS: Array<{ id: Preset; label: string }> = [
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "30d", label: "Last 30 Days" },
    { id: "quarter", label: "This Quarter" },
    { id: "3m", label: "Last 3 Months" },
    { id: "custom", label: "Custom" },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell eyebrow={`${from} – ${to}`} title={t("reportsV2")}>
      <div className="grid gap-6">

        {/* ── Controls ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Period presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  preset === p.id
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                className="h-9 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <span className="text-slate-400">–</span>
              <input
                className="h-9 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          )}

          {/* Department chips */}
          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            <button
              type="button"
              onClick={() => setDept("")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                !dept
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t("allDepartments")}
            </button>
            {depts.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDept(dept === d ? "" : d)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  dept === d
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {/* Attendance rate hero */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-800 p-4 shadow-sm sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Attendance Rate
            </div>
            <div className="mt-2 flex items-end gap-3">
              <div
                className={`text-5xl font-bold text-white transition-opacity ${loading ? "opacity-40" : ""}`}
              >
                {overallRate}%
              </div>
              <div className="mb-1 text-sm text-slate-400">
                of {totalRecs} records
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-green-400 transition-all duration-700"
                style={{ width: `${overallRate}%` }}
              />
            </div>
          </div>

          <KpiCard label={t("statusISDE")} value={isdeDays} color="green" />
          <KpiCard label={t("statusEZAMIYYET")} value={ezamiyyetDays} color="blue" />
          <KpiCard label="Absent / Other" value={absentDays} color="amber" />
          <KpiCard
            label={t("employees")}
            value={uniqueEmp}
            color="slate"
            icon={<Users size={14} />}
          />
        </section>

        {/* ── Trend + Day-of-week ────────────────────────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <h2 className="mb-0.5 font-semibold text-slate-950">
              Attendance Rate Over Time
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              % of records that are İşdə or Ezamiyyət, per day
            </p>
            {trendData.length > 0 ? (
              <ResponsiveContainer height={200} width="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v) => [`${v as number}%`, "Rate"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#rg)"
                    dot={false}
                    name="Rate"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-0.5 font-semibold text-slate-950">
              Day-of-Week Pattern
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Attendance rate by weekday
            </p>
            {dowData.some((d) => d.total > 0) ? (
              <ResponsiveContainer height={200} width="100%">
                <BarChart
                  data={dowData}
                  margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                >
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v) => [`${v as number}%`, "Rate"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Rate">
                    {dowData.map((d) => (
                      <Cell
                        key={d.day}
                        fill={
                          d.rate >= 80
                            ? "#22c55e"
                            : d.rate >= 60
                              ? "#f59e0b"
                              : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </section>

        {/* ── Department comparison ──────────────────────────────────────── */}
        {deptStats.length > 1 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-950">
              Department Comparison
            </h2>
            <div className="space-y-3">
              {deptStats.map((d) => (
                <div
                  key={d.dept}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 sm:grid-cols-[180px_1fr_56px]"
                >
                  <div className="truncate text-sm font-medium text-slate-700">
                    {d.dept}
                  </div>
                  <div className="hidden h-5 overflow-hidden rounded-full bg-slate-100 sm:flex">
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${(d.isde / d.records) * 100}%` }}
                    />
                    <div
                      className="h-full bg-blue-400 transition-all duration-500"
                      style={{ width: `${(d.ezamiyyet / d.records) * 100}%` }}
                    />
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-bold ${
                        d.rate >= 80
                          ? "text-green-600"
                          : d.rate >= 60
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {d.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
                {t("statusISDE")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400" />
                {t("statusEZAMIYYET")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200" />
                {t("other")}
              </span>
            </div>
          </section>
        )}

        {/* ── Attendance Heatmap ─────────────────────────────────────────── */}
        {empStats.length > 0 && heatDays.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-950">
                Attendance Heatmap
              </h2>
              <p className="text-xs text-slate-500">
                Each cell is one day — hover for details
              </p>
            </div>
            <div className="overflow-x-auto p-5">
              {/* Day number header */}
              <div className="mb-2 flex">
                <div className="w-44 shrink-0" />
                <div className="flex gap-x-0.5">
                  {heatDays.map((day, i) => {
                    const isFirstDay = i === 0;
                    const isFirstOfMonth = format(day, "d") === "1";
                    const isMonday = getDay(day) === 1;
                    const label =
                      isFirstDay || isFirstOfMonth || isMonday
                        ? format(day, "d")
                        : "";
                    return (
                      <div
                        key={format(day, "yyyy-MM-dd")}
                        className="w-4 shrink-0 text-center text-[8px] leading-3 text-slate-400"
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Employee rows */}
              <div className="space-y-1">
                {empStats.map((emp) => (
                  <div key={emp.employeeId} className="flex items-center">
                    <div className="w-44 shrink-0 truncate pr-3 text-xs font-medium text-slate-600">
                      {emp.employeeName}
                    </div>
                    <div className="flex gap-x-0.5">
                      {heatDays.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const status = recMap.get(
                          `${emp.employeeId}|${dateStr}`,
                        );
                        const isWeekend =
                          getDay(day) === 0 || getDay(day) === 6;
                        return (
                          <div
                            key={dateStr}
                            className="h-3.5 w-4 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: status
                                ? STATUS_COLORS[status]
                                : isWeekend
                                  ? "#f8fafc"
                                  : "#f1f5f9",
                            }}
                            title={
                              status
                                ? `${emp.employeeName} · ${dateStr} · ${t(statusKey(status))}`
                                : `${emp.employeeName} · ${dateStr} · No record`
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3">
                {(
                  [
                    "ISDE",
                    "EZAMIYYET",
                    "MEZUNIYYET",
                    "XESTE",
                    "BAYRAM",
                    "ICAZELI",
                    "ISTIRAHET",
                    "ISDE_DEYIL",
                  ] as AttendanceStatus[]
                ).map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 text-xs text-slate-500"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-[2px]"
                      style={{ backgroundColor: STATUS_COLORS[s] }}
                    />
                    {t(statusKey(s))}
                  </span>
                ))}
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="inline-block h-3 w-3 rounded-[2px] bg-slate-200" />
                  No record
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ── Alerts + Rankings ─────────────────────────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-2">
          {/* Alerts */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <AlertTriangle size={15} className="text-amber-500" />
              <h2 className="font-semibold text-slate-950">Alerts</h2>
              {alerts.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {alerts.length}
                </span>
              )}
            </div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-xl">
                  ✓
                </div>
                <p className="text-sm text-slate-400">
                  No alerts for this period
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {alerts.map((a, i) => {
                  const cfg = {
                    vacation: { icon: "🏖", label: "Vacation limit" },
                    sick: { icon: "🤒", label: "Sick day limit" },
                    lowRate: { icon: "📉", label: "Low attendance" },
                    zero: { icon: "⚠️", label: "Zero work days" },
                  }[a.type];
                  return (
                    <div key={i} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-0.5 text-base">{cfg.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800">
                            {a.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-medium text-slate-400">
                            {a.dept}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {cfg.label} — {a.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rankings */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-950">
                Employee Rankings
              </h2>
              <p className="text-xs text-slate-500">
                By attendance rate · min. 3 records in period
              </p>
            </div>
            {ranked.length === 0 ? (
              <Empty />
            ) : (
              <div className="p-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-green-600">
                  Top
                </p>
                <div className="mb-5 space-y-3">
                  {ranked.slice(0, 5).map((e, i) => (
                    <RankRow
                      key={e.employeeId}
                      rank={i + 1}
                      name={e.employeeName}
                      dept={e.department}
                      rate={e.rate}
                    />
                  ))}
                </div>
                {ranked.length > 5 && (
                  <>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
                      Needs Attention
                    </p>
                    <div className="space-y-3">
                      {[...ranked]
                        .reverse()
                        .slice(0, 5)
                        .filter(
                          (e) =>
                            !ranked
                              .slice(0, 5)
                              .find((t) => t.employeeId === e.employeeId),
                        )
                        .map((e) => {
                          const rank =
                            ranked.findIndex(
                              (r) => r.employeeId === e.employeeId,
                            ) + 1;
                          return (
                            <RankRow
                              key={e.employeeId}
                              rank={rank}
                              name={e.employeeName}
                              dept={e.department}
                              rate={e.rate}
                              bottom
                            />
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Loading toast */}
      {loading && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center pb-6 sm:items-center sm:pb-0">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-xl">
            Refreshing analytics…
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color = "slate",
  icon,
}: {
  label: string;
  value: number;
  color?: "green" | "blue" | "amber" | "slate";
  icon?: React.ReactNode;
}) {
  const c = {
    green: {
      bg: "bg-green-50",
      border: "border-green-200",
      val: "text-green-900",
      lbl: "text-green-600",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      val: "text-blue-900",
      lbl: "text-blue-600",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      val: "text-amber-900",
      lbl: "text-amber-600",
    },
    slate: {
      bg: "bg-white",
      border: "border-slate-200",
      val: "text-slate-950",
      lbl: "text-slate-500",
    },
  }[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 shadow-sm`}>
      <div
        className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${c.lbl}`}
      >
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${c.val}`}>{value}</div>
    </div>
  );
}

function RankRow({
  rank,
  name,
  dept,
  rate,
  bottom = false,
}: {
  rank: number;
  name: string;
  dept: string;
  rate: number;
  bottom?: boolean;
}) {
  const barColor = bottom
    ? rate < 60
      ? "bg-red-500"
      : "bg-amber-400"
    : "bg-green-500";
  const textColor = bottom
    ? rate < 60
      ? "text-red-600"
      : "text-amber-600"
    : "text-green-600";

  return (
    <div className="flex items-center gap-3">
      <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-300">
        #{rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-700">
            {name}
          </span>
          <span className={`shrink-0 text-sm font-bold ${textColor}`}>
            {rate}%
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${rate}%` }}
          />
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">{dept}</div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-slate-300">
      No data for this period
    </div>
  );
}
