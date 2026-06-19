"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { use } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  isWeekend,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { az, enUS, ru } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { statusKey, useLanguage } from "@/lib/i18n";
import type { AttendanceRecord, AttendanceStatus, Holiday, StatusColor } from "@/types/domain";

type Employee = { id: number; name: string; department: string; vacationLimit: number | null; sickLimit: number | null };

function toDateKey(v: string | Date) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return format(new Date(v), "yyyy-MM-dd");
}

const STATUS_ABBREV: Record<AttendanceStatus, string> = {
  ISDE: "İ",
  EZAMIYYET: "E",
  MEZUNIYYET: "M",
  XESTE: "X",
  BAYRAM: "B",
  ICAZELI: "İc",
  ISTIRAHET: "Is",
  ISDE_DEYIL: "D",
  ISDE_XESARET: "Xs",
};

export default function EmployeeHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const employeeId = Number(idStr);
  const { language, t } = useLanguage();
  const dateLocale = language === "az" ? az : language === "ru" ? ru : enUS;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [yearRecords, setYearRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [statusColors, setStatusColors] = useState<StatusColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const year = month.getFullYear();
  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(month), "yyyy-MM-dd");
  const yearFrom = format(startOfYear(month), "yyyy-MM-dd");
  const yearTo = format(endOfYear(month), "yyyy-MM-dd");

  useEffect(() => {
    fetch(`/api/employees/${employeeId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setEmployee(d as Employee); })
      .catch(() => {});
  }, [employeeId]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [recRes, holRes, colRes, yrRes] = await Promise.all([
        fetch(`/api/attendance-records?employeeId=${employeeId}&from=${from}&to=${to}`),
        fetch(`/api/holidays?from=${from}&to=${to}`),
        fetch("/api/status-colors"),
        fetch(`/api/attendance-records?employeeId=${employeeId}&from=${yearFrom}&to=${yearTo}`),
      ]);
      if (!recRes.ok) throw new Error("Could not load records.");
      setRecords(await recRes.json());
      if (holRes.ok) setHolidays(await holRes.json());
      if (colRes.ok) setStatusColors(await colRes.json());
      if (yrRes.ok) setYearRecords(await yrRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [employeeId, from, to, yearFrom, yearTo]);

  useEffect(() => { void loadMonth(); }, [loadMonth]);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const holidayByDate = useMemo(
    () => new Map(holidays.map((h) => [toDateKey(h.date), h])),
    [holidays],
  );
  const recordByDate = useMemo(
    () => new Map(records.map((r) => [toDateKey(r.date), r])),
    [records],
  );
  const colorByStatus = useMemo(
    () => new Map(statusColors.map((s) => [s.status, s.color])),
    [statusColors],
  );
  const displayTextByStatus = useMemo(
    () => new Map(statusColors.map((s) => [s.status, s.displayText])),
    [statusColors],
  );

  // Year summary counts
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of yearRecords) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  }, [yearRecords]);

  const topStatuses = Object.entries(yearCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const STATUS_COLORS: Record<string, string> = {
    ISDE: "#22c55e", EZAMIYYET: "#3b82f6", MEZUNIYYET: "#f59e0b",
    XESTE: "#ef4444", BAYRAM: "#a855f7", ICAZELI: "#f97316",
    ISTIRAHET: "#94a3b8", ISDE_DEYIL: "#6b7280", ISDE_XESARET: "#f43f5e",
  };

  return (
    <AppShell
      title={employee?.name ?? t("attendanceHistory")}
      eyebrow={employee?.department ?? t("employees")}
    >
      <div className="flex flex-col gap-5">
        {/* Back link */}
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={14} />
          {t("backToEmployees")}
        </Link>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Year summary */}
        {(topStatuses.length > 0 || employee?.sickLimit != null || employee?.vacationLimit != null) && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("yearSummary")} {year}</p>
            <div className="flex flex-wrap gap-2">
              {topStatuses.map(([status, count]) => {
                const limit = status === "MEZUNIYYET" ? employee?.vacationLimit : status === "XESTE" ? employee?.sickLimit : null;
                return (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: colorByStatus.get(status as AttendanceStatus) ?? STATUS_COLORS[status] ?? "#94a3b8" }}
                  >
                    {t(statusKey(status))}
                    <span className="rounded-full bg-black/20 px-1.5 py-0.5">
                      {count}{limit != null ? ` / ${limit}` : ""}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Month grid */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-44 text-center font-semibold text-slate-950">
              {format(month, "MMMM yyyy", { locale: dateLocale })}
            </span>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">{t("loading")}…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {days.map((day) => {
                      const dk = format(day, "yyyy-MM-dd");
                      const holiday = holidayByDate.get(dk);
                      const isToday = dk === todayKey;
                      const shaded = holiday
                        ? "bg-orange-100 text-orange-800"
                        : isWeekend(day)
                          ? "bg-slate-200 text-slate-600"
                          : isToday
                            ? "bg-blue-100 text-blue-700"
                            : "text-slate-600";
                      return (
                        <th
                          key={dk}
                          className={`border-r border-slate-100 px-1 py-2 text-center font-medium ${shaded}`}
                          style={{ minWidth: 36, width: 36 }}
                          title={holiday?.description}
                        >
                          <div>{format(day, "d")}</div>
                          <div className="text-[10px] uppercase">{format(day, "EEE", { locale: dateLocale })}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {days.map((day) => {
                      const dk = format(day, "yyyy-MM-dd");
                      const record = recordByDate.get(dk);
                      const holiday = holidayByDate.get(dk);
                      const isToday = dk === todayKey;
                      const base = holiday ? "bg-orange-50" : isWeekend(day) ? "bg-slate-100" : isToday ? "bg-blue-50" : "";
                      const color = record ? colorByStatus.get(record.status) : undefined;
                      const text = record
                        ? (displayTextByStatus.get(record.status) || STATUS_ABBREV[record.status] || record.status.slice(0, 1))
                        : "";
                      return (
                        <td
                          key={dk}
                          className={`border-r border-slate-100 p-1 ${base}`}
                          style={{ minWidth: 36, width: 36 }}
                        >
                          {record ? (
                            <div
                              className="flex min-h-10 items-center justify-center rounded text-center text-[10px] font-semibold text-white"
                              style={{ backgroundColor: color ?? "#94a3b8" }}
                              title={`${t(statusKey(record.status))}${record.note ? " · " + record.note : ""}`}
                            >
                              {text}
                            </div>
                          ) : (
                            <div className="min-h-10" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Month status legend */}
        {records.length > 0 && (() => {
          const mc: Record<string, number> = {};
          for (const r of records) mc[r.status] = (mc[r.status] ?? 0) + 1;
          return (
            <div className="flex flex-wrap gap-2">
              {Object.entries(mc).sort((a, b) => b[1] - a[1]).map(([status, cnt]) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: colorByStatus.get(status as AttendanceStatus) ?? STATUS_COLORS[status] ?? "#94a3b8" }}
                >
                  {t(statusKey(status))} · {cnt}
                </span>
              ))}
            </div>
          );
        })()}
      </div>
    </AppShell>
  );
}
