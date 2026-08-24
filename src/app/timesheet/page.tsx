"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  startOfMonth,
  subDays,
} from "date-fns";
import type { Locale } from "date-fns";
import { az, enUS, ru } from "date-fns/locale";
import { AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, Flag, Plus, Printer, Trash2, Users, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { statusKey, useLanguage } from "@/lib/i18n";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Car,
  Employee,
  ExpenseType,
  Holiday,
  Location,
  PaymentType,
  StatusColor,
} from "@/types/domain";

const paymentTypeValues: PaymentType[] = ["BONUS", "EZAM_ELAVE", "AVANS"];

const paymentTypeLabelKey: Record<PaymentType, string> = {
  BONUS: "paymentBonus",
  EZAM_ELAVE: "paymentEzamElave",
  AVANS: "paymentAvans",
};

const expenseTypeValues: ExpenseType[] = ["FOOD", "TOOL", "FINE", "OTHER"];

const expenseTypeLabelKey: Record<ExpenseType, string> = {
  FOOD: "expenseFood",
  TOOL: "expenseTool",
  FINE: "expenseFine",
  OTHER: "other",
};

// Calculated amounts accumulate across an interval (e.g. 40/day for 5 days),
// then a later record can settle the running total with calculated=0, paid=200.
// So a record with no calculated amount but a paid amount is a pure payment entry.
function paymentBadgeAmount(amount: number | null, paid: number | null) {
  const calc = amount ?? 0;
  const paidAmount = paid ?? 0;
  return calc > 0 ? calc : paidAmount;
}

function paymentBadgeColor(amount: number | null, paid: number | null) {
  const calc = amount ?? 0;
  const paidAmount = paid ?? 0;
  if (calc <= 0) return paidAmount > 0 ? "text-emerald-700" : "text-slate-700";
  if (paidAmount >= calc) return "text-emerald-700";
  if (paidAmount > 0) return "text-amber-600";
  return "text-red-600";
}

function paymentBadgeIcon(amount: number | null, paid: number | null) {
  const calc = amount ?? 0;
  const paidAmount = paid ?? 0;
  if (calc <= 0) return paidAmount > 0 ? "✓" : "●";
  if (paidAmount >= calc) return "✓";
  if (paidAmount > 0) return "◐";
  return "●";
}

const statusValues: AttendanceStatus[] = [
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

const carAllowedStatuses = new Set<AttendanceStatus>([
  "ISDE",
  "EZAMIYYET",
  "MEZUNIYYET",
  "BAYRAM",
  "ISDE_XESARET",
]);

function toClientDateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return format(new Date(value), "yyyy-MM-dd");
}

type ActiveCell = {
  employee: Employee;
  dateKey: string;
  record?: AttendanceRecord;
};

export default function TimesheetPage() {
  const { language, t } = useLanguage();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [statusColors, setStatusColors] = useState<StatusColor[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [formNotes, setFormNotes] = useState<Array<{ employeeId: number; date: string; text: string }>>([]);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: "", department: "" });
  const [loading, setLoading] = useState(true);
  const isInitialLoadRef = useRef(true);
  const [error, setError] = useState("");
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());
  const [confirmFillDate, setConfirmFillDate] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus | "">("");
  const [bulkDate, setBulkDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [bulkLoading, setBulkLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const todayDateKey = format(new Date(), "yyyy-MM-dd");
  const canBypassEditLock = role === "ADMIN" || role === "SUPERVISOR";
  const editLockCutoffKey = format(subDays(new Date(), 5), "yyyy-MM-dd");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLTableCellElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (!loading && !hasScrolledRef.current && todayCellRef.current && scrollContainerRef.current) {
      hasScrolledRef.current = true;
      const container = scrollContainerRef.current;
      const cell = todayCellRef.current;
      const containerRect = container.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const stickyWidth = 224; // min-w-56 sticky employee column
      container.scrollLeft += cellRect.left - containerRect.left - stickyWidth;
    }
  }, [loading]);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month],
  );
  const dateLocale = language === "az" ? az : language === "ru" ? ru : enUS;
  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(month), "yyyy-MM-dd");

  const holidayByDate = useMemo(
    () => new Map(holidays.map((holiday) => [toClientDateKey(holiday.date), holiday])),
    [holidays],
  );
  const recordByCell = useMemo(
    () =>
      new Map(
        records.map((record) => [`${record.employeeId}:${toClientDateKey(record.date)}`, record]),
      ),
    [records],
  );
  const formNoteByCell = useMemo(
    () => new Map(formNotes.map((item) => [`${item.employeeId}:${item.date}`, item.text])),
    [formNotes],
  );
  const colorByStatus = useMemo(
    () => new Map(statusColors.map((item) => [item.status, item.color])),
    [statusColors],
  );
  const displayTextByStatus = useMemo(
    () => new Map(statusColors.map((item) => [item.status, item.displayText])),
    [statusColors],
  );
  const cellWidth = useMemo(() => {
    const maxDisplayLength = Math.max(
      1,
      ...statusColors.map((item) => item.displayText.length),
    );

    return Math.max(56, Math.min(160, maxDisplayLength * 9 + 24));
  }, [statusColors]);

  const loadData = useCallback(async () => {
    if (isInitialLoadRef.current) setLoading(true);
    setError("");

    try {
      const [
        employeeResponse,
        holidayResponse,
        recordResponse,
        locationResponse,
        carResponse,
        statusColorResponse,
        formNotesResponse,
      ] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/holidays?from=${from}&to=${to}`),
        fetch(`/api/attendance-records?from=${from}&to=${to}`),
        fetch("/api/locations"),
        fetch("/api/cars"),
        fetch("/api/status-colors"),
        fetch(`/api/forms/daily-log/summary?from=${from}&to=${to}`),
      ]);

      if (
        !employeeResponse.ok ||
        !holidayResponse.ok ||
        !recordResponse.ok ||
        !locationResponse.ok ||
        !carResponse.ok ||
        !statusColorResponse.ok ||
        !formNotesResponse.ok
      ) {
        throw new Error("Could not load timesheet data.");
      }

      setEmployees(await employeeResponse.json());
      setHolidays(await holidayResponse.json());
      setRecords(await recordResponse.json());
      setLocations(await locationResponse.json());
      setCars(await carResponse.json());
      setStatusColors(await statusColorResponse.json());
      setFormNotes(await formNotesResponse.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load timesheet data.");
    } finally {
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        setLoading(false);
      }
    }
  }, [from, to]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    hasScrolledRef.current = false;
    void loadData();
  }, [loadData]);

  // Auto-refresh every 30 s so concurrent editors stay in sync
  useEffect(() => {
    const timer = setInterval(() => void loadData(), 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.role) setRole(data.role); });
  }, []);

  const departments = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const e of employees) {
      if (!seen.has(e.department)) { seen.add(e.department); order.push(e.department); }
    }
    return order;
  }, [employees]);

  function toggleDept(dept: string) {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  }

  function toggleAllDepts(collapse: boolean) {
    setCollapsedDepts(collapse ? new Set(departments) : new Set());
  }

  async function bulkMarkHoliday(dateKey: string) {
    setConfirmFillDate(null);
    const res = await fetch("/api/attendance-records/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateKey, status: "BAYRAM" }),
    });
    if (res.ok) await loadData();
    else setError("Could not mark column as holiday.");
  }

  async function bulkApply() {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkLoading(true);
    const res = await fetch("/api/attendance-records/bulk-selected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: bulkDate, status: bulkStatus, employeeIds: [...selectedIds] }),
    });
    if (res.ok) {
      setSelectedIds(new Set());
      await loadData();
    } else {
      setError("Bulk update failed.");
    }
    setBulkLoading(false);
  }

  async function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(employeeForm),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not add employee.");
      return;
    }

    setEmployeeForm({ name: "", department: "" });
    await loadData();
  }

  function openCell(employee: Employee, dateKey: string) {
    const record = recordByCell.get(`${employee.id}:${dateKey}`);
    setActiveCell({ employee, dateKey, record });
  }

  async function closeModal(refresh = false) {
    setActiveCell(null);

    if (refresh) {
      await loadData();
    }
  }

  return (
    <AppShell title={t("timesheet")} eyebrow={format(month, "MMMM yyyy", { locale: dateLocale })}>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between print:hidden">
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setMonth((current) => addMonths(current, -1))}
              title="Previous month"
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-44 text-center text-lg font-semibold text-slate-950">
              {format(month, "MMMM yyyy", { locale: dateLocale })}
            </div>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              title="Next month"
              type="button"
            >
              <ChevronRight size={18} />
            </button>
            <div className="ml-2 flex gap-1">
              <button
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => toggleAllDepts(false)}
                title={t("expandAll")}
                type="button"
              >
                <ChevronDown size={13} /> {t("expandAll")}
              </button>
              <button
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => toggleAllDepts(true)}
                title={t("collapseAll")}
                type="button"
              >
                <ChevronUp size={13} /> {t("collapseAll")}
              </button>
              <button
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => window.print()}
                title={t("print")}
                type="button"
              >
                <Printer size={13} /> {t("print")}
              </button>
              <button
                className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition ${bulkMode ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                onClick={() => { setBulkMode((v) => !v); setSelectedIds(new Set()); }}
                type="button"
              >
                <Users size={13} /> {t("bulkSelect")}
              </button>
            </div>
          </div>
          <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={addEmployee}>
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setEmployeeForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("employee")}
              value={employeeForm.name}
            />
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) =>
                setEmployeeForm((current) => ({ ...current, department: event.target.value }))
              }
              placeholder={t("department")}
              value={employeeForm.department}
            />
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Plus size={16} />
              {t("add")}
            </button>
          </form>
        </section>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto" ref={scrollContainerRef}>
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-20 min-w-56 border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                    <div className="flex items-center gap-2">
                      {bulkMode && (
                        <input type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={employees.length > 0 && selectedIds.size === employees.length}
                          onChange={(e) => setSelectedIds(e.target.checked ? new Set(employees.map((emp) => emp.id)) : new Set())}
                        />
                      )}
                      {t("employee")}
                    </div>
                  </th>
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const holiday = holidayByDate.get(dateKey);
                    const isToday = dateKey === todayDateKey;
                    const isConfirming = confirmFillDate === dateKey;
                    const shaded = holiday
                      ? "bg-orange-100 text-orange-950"
                      : isWeekend(day)
                        ? "bg-slate-200 text-slate-800"
                        : isToday
                          ? "bg-blue-100 text-blue-900"
                          : "bg-slate-50 text-slate-700";

                    return (
                      <th
                        className={`border-r border-slate-200 px-1 py-1 text-center font-semibold ${shaded}`}
                        key={dateKey}
                        ref={isToday ? todayCellRef : undefined}
                        style={{ minWidth: cellWidth, width: cellWidth }}
                        title={holiday?.description}
                      >
                        <div className="text-sm">{format(day, "d")}</div>
                        <div className="text-[11px] font-medium uppercase">{format(day, "EEE", { locale: dateLocale })}</div>
                        <div className="mt-0.5 flex justify-center print:hidden">
                          {isConfirming ? (
                            <div className="flex gap-0.5">
                              <button
                                className="rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-amber-600"
                                onClick={() => void bulkMarkHoliday(dateKey)}
                                type="button"
                                title={t("markColumnConfirm")}
                              >✓</button>
                              <button
                                className="rounded bg-slate-300 px-1 py-0.5 text-[9px] font-bold text-slate-700 hover:bg-slate-400"
                                onClick={() => setConfirmFillDate(null)}
                                type="button"
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              className="rounded p-0.5 text-slate-300 hover:text-amber-500"
                              onClick={() => setConfirmFillDate(dateKey)}
                              type="button"
                              title={t("markAsHoliday")}
                            >
                              <Flag size={9} />
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={days.length + 1}>
                      {t("loading")}
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={days.length + 1}>
                      {t("noEmployees")}
                    </td>
                  </tr>
                ) : (
                  departments.flatMap((dept) => {
                    const deptEmployees = employees.filter((e) => e.department === dept);
                    const isCollapsed = collapsedDepts.has(dept);
                    return [
                      // Department header row
                      <tr key={`dept-${dept}`} className="border-b border-slate-200 bg-slate-100">
                        <th
                          className="sticky left-0 z-20 border-r border-slate-200 bg-slate-100 px-3 py-1.5 text-left"
                          colSpan={1}
                        >
                          <button
                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900"
                            onClick={() => toggleDept(dept)}
                            type="button"
                          >
                            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                            {dept}
                            <span className="font-normal text-slate-400">({deptEmployees.length})</span>
                          </button>
                        </th>
                        {days.map((day) => (
                          <td
                            key={format(day, "yyyy-MM-dd")}
                            className="border-r border-slate-200 bg-slate-100"
                            style={{ minWidth: cellWidth, width: cellWidth }}
                          />
                        ))}
                      </tr>,
                      // Employee rows (hidden when collapsed)
                      ...(!isCollapsed ? deptEmployees.map((employee) => (
                        <tr className="border-b border-slate-100" key={employee.id}>
                          <th className="sticky left-0 z-20 min-w-56 border-r border-slate-200 bg-white px-3 py-2 text-left">
                            <div className="flex items-center gap-2">
                              {bulkMode && (
                                <input type="checkbox"
                                  className="h-4 w-4 shrink-0 rounded border-slate-300"
                                  checked={selectedIds.has(employee.id)}
                                  onChange={(e) => setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(employee.id); else next.delete(employee.id);
                                    return next;
                                  })}
                                />
                              )}
                              <div className="font-semibold text-slate-950">{employee.name}</div>
                            </div>
                          </th>
                          {days.map((day) => {
                            const dateKey = format(day, "yyyy-MM-dd");
                            const record = recordByCell.get(`${employee.id}:${dateKey}`);
                            const holiday = holidayByDate.get(dateKey);
                            const isToday = dateKey === todayDateKey;
                            const base = holiday ? "bg-orange-50" : isWeekend(day) ? "bg-slate-100" : isToday ? "bg-blue-50" : "bg-white";
                            const statusText = record
                              ? displayTextByStatus.get(record.status) ?? record.status.slice(0, 1)
                              : "";
                            const statusColor = record ? colorByStatus.get(record.status) : undefined;
                            const ezamiyyetLocation = record?.status === "EZAMIYYET" ? record.location : null;
                            const workLocationText = record?.status === "ISDE" ? record.workLocations.map((item) => item.name).join(", ") : "";
                            const carText = record?.carDriven && record.car ? record.car.licensePlate : "";
                            const formNoteText = formNoteByCell.get(`${employee.id}:${dateKey}`);
                            const hasTooltip = Boolean(record?.note) || Boolean(formNoteText);

                            return (
                              <td
                                className={`group relative border-r border-slate-100 p-1 ${base}`}
                                key={dateKey}
                                style={{ minWidth: cellWidth, width: cellWidth }}
                              >
                                {record?.note ? (
                                  <span className="pointer-events-none absolute left-1 top-1 z-10 text-amber-500">
                                    <AlertTriangle fill="currentColor" size={18} stroke="white" strokeWidth={1.5} />
                                  </span>
                                ) : null}
                                {formNoteText ? (
                                  <span className="pointer-events-none absolute right-1 top-1 z-10 text-emerald-500">
                                    <CircleCheck fill="currentColor" size={18} stroke="white" strokeWidth={1.5} />
                                  </span>
                                ) : null}
                                {hasTooltip ? (
                                  <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-max max-w-xs -translate-x-1/2 space-y-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-normal leading-snug text-white shadow-lg group-hover:block">
                                    {record?.note ? <div>{record.note}</div> : null}
                                    {formNoteText ? (
                                      <div className="whitespace-pre-line border-t border-slate-700 pt-2 text-emerald-200 first:border-0 first:pt-0">
                                        {formNoteText}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                <button
                                  className="flex min-h-14 w-full flex-col items-center justify-center rounded-md border border-transparent px-1 py-1 text-center text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-white"
                                  onClick={() => openCell(employee, dateKey)}
                                  style={statusColor ? { backgroundColor: statusColor } : undefined}
                                  title={hasTooltip ? undefined : `${employee.name} ${dateKey}`}
                                  type="button"
                                >
                                  <span className="max-w-full truncate">{statusText}</span>
                                  {record?.workerName ? (
                                    <span className="max-w-full truncate text-[10px] font-semibold text-purple-700">{record.workerName}</span>
                                  ) : null}
                                  {ezamiyyetLocation ? (
                                    <span className="max-w-full truncate text-[10px] font-medium text-slate-700">{ezamiyyetLocation}</span>
                                  ) : null}
                                  {workLocationText ? (
                                    <span className="max-w-full truncate text-[10px] font-medium text-slate-700">{workLocationText}</span>
                                  ) : null}
                                  {record?.cookedHeadcount ? (
                                    <span className={`text-[10px] font-medium ${record.cookedPaid ? "text-emerald-700" : "text-amber-600"}`}>
                                      {t("cook")}: {record.cookedHeadcount} {record.cookedPaid ? "✓" : "●"}
                                    </span>
                                  ) : null}
                                  {carText ? (
                                    <span className="max-w-full truncate text-[10px] font-medium text-slate-700">Car: {carText}</span>
                                  ) : null}
                                  {record?.paymentType ? (
                                    <span className={`max-w-full truncate text-[10px] font-medium ${paymentBadgeColor(record.paymentAmount, record.paymentPaid)}`}>
                                      {t(paymentTypeLabelKey[record.paymentType])}: ₼{paymentBadgeAmount(record.paymentAmount, record.paymentPaid)} {paymentBadgeIcon(record.paymentAmount, record.paymentPaid)}
                                    </span>
                                  ) : null}
                                  {record?.expenseType ? (
                                    <span className="max-w-full truncate text-[10px] font-medium text-orange-700">
                                      {t(expenseTypeLabelKey[record.expenseType])}: ₼{record.expenseAmount}
                                    </span>
                                  ) : null}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      )) : []),
                    ];
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 shadow-xl">
          <span className="text-sm font-semibold text-slate-700">{selectedIds.size} {t("employee")}</span>
          <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}
            className="h-8 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
            className="h-8 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="">{t("status")}</option>
            {statusValues.map((s) => <option key={s} value={s}>{t(statusKey(s))}</option>)}
          </select>
          <button onClick={() => void bulkApply()} disabled={!bulkStatus || bulkLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 transition">
            {bulkLoading ? "…" : <Check size={13} />}
            {t("apply")}
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            <X size={13} />
          </button>
        </div>
      )}

      {activeCell ? (
        <AttendanceModal
          key={`${activeCell.employee.id}:${activeCell.dateKey}`}
          activeCell={activeCell}
          cars={cars}
          dateLocale={dateLocale}
          formNote={formNoteByCell.get(`${activeCell.employee.id}:${activeCell.dateKey}`)}
          locations={locations}
          locked={!canBypassEditLock && activeCell.dateKey < editLockCutoffKey}
          onClose={closeModal}
        />
      ) : null}
    </AppShell>
  );
}

function AttendanceModal({
  activeCell,
  cars,
  dateLocale,
  formNote,
  locations,
  locked,
  onClose,
}: {
  activeCell: ActiveCell;
  cars: Car[];
  dateLocale: Locale;
  formNote?: string;
  locations: Location[];
  locked: boolean;
  onClose: (refresh?: boolean) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<AttendanceStatus>(activeCell.record?.status ?? "ISDE");
  const [location, setLocation] = useState(activeCell.record?.location ?? "");
  const [workLocationIds, setWorkLocationIds] = useState<number[]>(
    activeCell.record?.workLocations.map((item) => item.id) ?? [],
  );
  const [newWorkLocationNames, setNewWorkLocationNames] = useState<string[]>([]);
  const [newWorkLocationName, setNewWorkLocationName] = useState("");
  const [actedAsCook, setActedAsCook] = useState(Boolean(activeCell.record?.cookedHeadcount));
  const [cookedHeadcount, setCookedHeadcount] = useState(
    activeCell.record?.cookedHeadcount?.toString() ?? "",
  );
  const [cookedPaid, setCookedPaid] = useState(Boolean(activeCell.record?.cookedPaid));
  const [carDriven, setCarDriven] = useState(Boolean(activeCell.record?.carDriven));
  const [carId, setCarId] = useState(activeCell.record?.carId?.toString() ?? "");
  const [note, setNote] = useState(activeCell.record?.note ?? "");
  const [workerName, setWorkerName] = useState(activeCell.record?.workerName ?? "");
  const [paymentType, setPaymentType] = useState<PaymentType | "">(
    activeCell.record?.paymentType ?? "",
  );
  const [paymentAmount, setPaymentAmount] = useState(
    activeCell.record?.paymentAmount?.toString() ?? "0",
  );
  const [paymentPaid, setPaymentPaid] = useState(
    activeCell.record?.paymentPaid?.toString() ?? "0",
  );
  const [expenseType, setExpenseType] = useState<ExpenseType | "">(
    activeCell.record?.expenseType ?? "",
  );
  const [expenseAmount, setExpenseAmount] = useState(
    activeCell.record?.expenseAmount?.toString() ?? "",
  );
  const [error, setError] = useState("");
  const canSelectCar = carAllowedStatuses.has(status);

  function toggleWorkLocation(locationId: number) {
    setWorkLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId],
    );
  }

  function addNewWorkLocation() {
    const nextLocation = newWorkLocationName.trim();

    if (!nextLocation) {
      return;
    }

    setNewWorkLocationNames((current) =>
      current.some((item) => item.toLocaleLowerCase() === nextLocation.toLocaleLowerCase())
        ? current
        : [...current, nextLocation],
    );
    setNewWorkLocationName("");
  }

  async function saveAttendance() {
    setError("");

    if (locked) {
      setError(t("recordLocked"));
      return;
    }

    if (paymentType && Number(paymentAmount || "0") <= 0 && Number(paymentPaid || "0") <= 0) {
      setError(t("paymentValueRequired"));
      return;
    }

    if (expenseType && Number(expenseAmount || "0") <= 0) {
      setError(t("expenseAmountRequired"));
      return;
    }

    const payload = {
      employeeId: activeCell.employee.id,
      date: activeCell.dateKey,
      status,
      location: status === "EZAMIYYET" ? location : null,
      workLocationIds: status === "ISDE" ? workLocationIds : [],
      newWorkLocationNames: status === "ISDE" ? newWorkLocationNames : [],
      carDriven: canSelectCar ? carDriven : false,
      carId: canSelectCar && carDriven ? Number(carId) : null,
      note: note.trim() ? note.trim() : null,
      workerName: activeCell.employee.isTemporary && workerName.trim() ? workerName.trim() : null,
      paymentType: paymentType || null,
      paymentAmount: paymentType ? Number(paymentAmount || "0") : null,
      paymentPaid: paymentType ? Number(paymentPaid || "0") : null,
      expenseType: expenseType || null,
      expenseAmount: expenseType ? Number(expenseAmount || "0") : null,
      cookedHeadcount:
        status === "EZAMIYYET" && actedAsCook && cookedHeadcount
          ? Number(cookedHeadcount)
          : null,
      cookedPaid: status === "EZAMIYYET" && actedAsCook && cookedHeadcount ? cookedPaid : false,
    };

    const response = await fetch("/api/attendance-records", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not save attendance.");
      return;
    }

    await onClose(true);
  }

  async function deleteAttendance() {
    if (!activeCell.record) {
      await onClose(false);
      return;
    }

    if (locked) {
      setError(t("recordLocked"));
      return;
    }

    const response = await fetch(`/api/attendance-records/${activeCell.record.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not delete attendance.");
      return;
    }

    await onClose(true);
  }

  // Keyboard shortcuts: 1-9 select status, Enter saves, Escape closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const idx = Number(e.key) - 1;
      if (!locked && idx >= 0 && idx < statusValues.length) {
        setStatus(statusValues[idx]);
      } else if (e.key === "Enter") {
        void saveAttendance();
      } else if (e.key === "Escape") {
        void onClose(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, location, workLocationIds, newWorkLocationNames, actedAsCook, cookedHeadcount, cookedPaid, carDriven, carId, note, workerName, paymentType, paymentAmount, paymentPaid, expenseType, expenseAmount]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
      <div className="flex max-h-full w-full max-w-md flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-950">{activeCell.employee.name}</h2>
            <p className="text-sm text-slate-500">
              {format(new Date(activeCell.dateKey), "PPP", { locale: dateLocale })}
            </p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => void onClose(false)}
            title={t("close")}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto px-4 py-4">
          {locked ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("recordLocked")}
            </div>
          ) : null}
          <fieldset className="contents" disabled={locked}>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("status")}
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setStatus(event.target.value as AttendanceStatus)}
              value={status}
            >
              {statusValues.map((option) => (
                <option key={option} value={option}>
                  {t(statusKey(option))}
                </option>
              ))}
            </select>
          </label>

          {activeCell.employee.isTemporary ? (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("workerName")}
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                onChange={(event) => setWorkerName(event.target.value)}
                value={workerName}
              />
            </label>
          ) : null}

          {status === "EZAMIYYET" ? (
            <>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("location")}
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                  onChange={(event) => setLocation(event.target.value)}
                  value={location}
                >
                  <option value="">{t("selectLocation")}</option>
                  {locations.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={actedAsCook}
                  className="h-4 w-4 rounded border-slate-300"
                  onChange={(event) => setActedAsCook(event.target.checked)}
                  type="checkbox"
                />
                {t("actedAsCook")}
              </label>
              {actedAsCook ? (
                <>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    {t("cookedFor")}
                    <input
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                      min="1"
                      onChange={(event) => setCookedHeadcount(event.target.value)}
                      type="number"
                      value={cookedHeadcount}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      checked={cookedPaid}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                      onChange={(event) => setCookedPaid(event.target.checked)}
                      type="checkbox"
                    />
                    <span className={cookedPaid ? "text-emerald-700" : "text-amber-700"}>
                      {cookedPaid ? t("paid") : t("unpaid")}
                    </span>
                  </label>
                </>
              ) : null}
            </>
          ) : null}

          {status === "ISDE" ? (
            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-700">{t("workLocations")}</div>
              <div className="grid max-h-40 gap-2 overflow-y-auto pr-1">
                {locations.length === 0 ? (
                  <div className="text-sm text-slate-500">{t("noSavedLocations")}</div>
                ) : (
                  locations.map((option) => (
                    <label
                      className="flex items-center gap-2 text-sm font-medium text-slate-700"
                      key={option.id}
                    >
                      <input
                        checked={workLocationIds.includes(option.id)}
                        className="h-4 w-4 rounded border-slate-300"
                        onChange={() => toggleWorkLocation(option.id)}
                        type="checkbox"
                      />
                      {option.name}
                    </label>
                  ))
                )}
              </div>
              {newWorkLocationNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {newWorkLocationNames.map((name) => (
                    <button
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      key={name}
                      onClick={() =>
                        setNewWorkLocationNames((current) =>
                          current.filter((item) => item !== name),
                        )
                      }
                      type="button"
                    >
                      {name}
                      <X size={12} />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                  onChange={(event) => setNewWorkLocationName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addNewWorkLocation();
                    }
                  }}
                  placeholder={t("newLocation")}
                  value={newWorkLocationName}
                />
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={addNewWorkLocation}
                  type="button"
                >
                  <Plus size={16} />
                  {t("add")}
                </button>
              </div>
            </div>
          ) : null}

          {canSelectCar ? (
            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={carDriven}
                  className="h-4 w-4 rounded border-slate-300"
                  onChange={(event) => setCarDriven(event.target.checked)}
                  type="checkbox"
                />
                {t("carWasDriven")}
              </label>
              {carDriven ? (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("cars")}
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                    onChange={(event) => setCarId(event.target.value)}
                    value={carId}
                  >
                    <option value="">{t("selectCar")}</option>
                    {cars.filter((car) => !car.fuelOnly).map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.makeModel} - {car.licensePlate}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          <div className={`grid gap-3 ${paymentType ? "grid-cols-3" : "grid-cols-2"}`}>
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              {t("payment")}
              <select
                className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                onChange={(event) => setPaymentType(event.target.value as PaymentType | "")}
                value={paymentType}
              >
                <option value="">{t("paymentNone")}</option>
                {paymentTypeValues.map((option) => (
                  <option key={option} value={option}>
                    {t(paymentTypeLabelKey[option])}
                  </option>
                ))}
              </select>
            </label>
            {paymentType ? (
              <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                {paymentType === "AVANS" ? t("paymentGivenLabel") : t("paymentAmount")}
                <input
                  className="h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  min={0}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  type="number"
                  value={paymentAmount}
                />
              </label>
            ) : null}
            {paymentType ? (
              <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                {paymentType === "AVANS" ? t("paymentRepaidLabel") : t("paymentPaidLabel")}
                <input
                  className="h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  min={0}
                  onChange={(event) => setPaymentPaid(event.target.value)}
                  type="number"
                  value={paymentPaid}
                />
              </label>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              {t("expense")}
              <select
                className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                onChange={(event) => setExpenseType(event.target.value as ExpenseType | "")}
                value={expenseType}
              >
                <option value="">{t("expenseNone")}</option>
                {expenseTypeValues.map((option) => (
                  <option key={option} value={option}>
                    {t(expenseTypeLabelKey[option])}
                  </option>
                ))}
              </select>
            </label>
            {expenseType ? (
              <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                {t("expenseAmountLabel")}
                <input
                  className="h-10 w-full min-w-0 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  min={0}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  type="number"
                  value={expenseAmount}
                />
              </label>
            ) : null}
          </div>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("note")}
            <textarea
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          </fieldset>

          {formNote ? (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("formSubmission")}
              <textarea
                className="min-h-24 cursor-not-allowed resize-none rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-slate-700 outline-none"
                readOnly
                value={formNote}
              />
            </label>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-4 py-3">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={locked}
            onClick={deleteAttendance}
            type="button"
          >
            <Trash2 size={16} />
            {t("clear")}
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={locked}
            onClick={saveAttendance}
            type="button"
          >
            <Check size={16} />
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
