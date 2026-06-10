"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  startOfMonth,
} from "date-fns";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  Holiday,
  Location,
  StatusColor,
} from "@/types/domain";

const statuses: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "ISDE", label: "Isde" },
  { value: "EZAMIYYET", label: "Ezamiyyet" },
  { value: "MEZUNIYYET", label: "Mezuniyyet" },
  { value: "XESTE", label: "Xeste" },
];

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
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [statusColors, setStatusColors] = useState<StatusColor[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: "", department: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month],
  );
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
    setLoading(true);
    setError("");

    try {
      const [
        employeeResponse,
        holidayResponse,
        recordResponse,
        locationResponse,
        statusColorResponse,
      ] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/holidays?from=${from}&to=${to}`),
        fetch(`/api/attendance-records?from=${from}&to=${to}`),
        fetch("/api/locations"),
        fetch("/api/status-colors"),
      ]);

      if (
        !employeeResponse.ok ||
        !holidayResponse.ok ||
        !recordResponse.ok ||
        !locationResponse.ok ||
        !statusColorResponse.ok
      ) {
        throw new Error("Could not load timesheet data.");
      }

      setEmployees(await employeeResponse.json());
      setHolidays(await holidayResponse.json());
      setRecords(await recordResponse.json());
      setLocations(await locationResponse.json());
      setStatusColors(await statusColorResponse.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load timesheet data.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

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
    <AppShell title="Timesheet" eyebrow={format(month, "MMMM yyyy")}>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
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
              {format(month, "MMMM yyyy")}
            </div>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              title="Next month"
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={addEmployee}>
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setEmployeeForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Employee"
              value={employeeForm.name}
            />
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) =>
                setEmployeeForm((current) => ({ ...current, department: event.target.value }))
              }
              placeholder="Department"
              value={employeeForm.department}
            />
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Plus size={16} />
              Add
            </button>
          </form>
        </section>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-56 border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                    Employee
                  </th>
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const holiday = holidayByDate.get(dateKey);
                    const shaded = holiday
                      ? "bg-orange-100 text-orange-950"
                      : isWeekend(day)
                        ? "bg-slate-200 text-slate-800"
                        : "bg-slate-50 text-slate-700";

                    return (
                      <th
                        className={`border-r border-slate-200 px-2 py-2 text-center font-semibold ${shaded}`}
                        key={dateKey}
                        style={{ minWidth: cellWidth, width: cellWidth }}
                        title={holiday?.description}
                      >
                        <div>{format(day, "d")}</div>
                        <div className="text-[11px] font-medium uppercase">{format(day, "EEE")}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={days.length + 1}>
                      Loading
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={days.length + 1}>
                      No employees
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr className="border-b border-slate-100" key={employee.id}>
                      <th className="sticky left-0 z-10 min-w-56 border-r border-slate-200 bg-white px-3 py-2 text-left">
                        <div className="font-semibold text-slate-950">{employee.name}</div>
                        <div className="text-xs text-slate-500">{employee.department}</div>
                      </th>
                      {days.map((day) => {
                        const dateKey = format(day, "yyyy-MM-dd");
                        const record = recordByCell.get(`${employee.id}:${dateKey}`);
                        const holiday = holidayByDate.get(dateKey);
                        const base = holiday ? "bg-orange-50" : isWeekend(day) ? "bg-slate-100" : "bg-white";
                        const statusText = record
                          ? displayTextByStatus.get(record.status) ?? record.status.slice(0, 1)
                          : "";
                        const statusColor = record ? colorByStatus.get(record.status) : undefined;
                        const ezamiyyetLocation =
                          record?.status === "EZAMIYYET" ? record.location : null;

                        return (
                          <td
                            className={`border-r border-slate-100 p-1 ${base}`}
                            key={dateKey}
                            style={{ minWidth: cellWidth, width: cellWidth }}
                          >
                            <button
                              className="flex h-12 w-full flex-col items-center justify-center rounded-md border border-transparent px-1 text-center text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-white"
                              onClick={() => openCell(employee, dateKey)}
                              style={statusColor ? { backgroundColor: statusColor } : undefined}
                              title={`${employee.name} ${dateKey}`}
                              type="button"
                            >
                              <span className="max-w-full truncate">{statusText}</span>
                              {ezamiyyetLocation ? (
                                <span className="max-w-full truncate text-[10px] font-medium text-slate-700">
                                  {ezamiyyetLocation}
                                </span>
                              ) : null}
                              {record?.cookedHeadcount ? (
                                <span className="text-[10px] text-emerald-700">
                                  Cook: {record.cookedHeadcount}
                                </span>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {activeCell ? (
        <AttendanceModal
          key={`${activeCell.employee.id}:${activeCell.dateKey}`}
          activeCell={activeCell}
          locations={locations}
          onClose={closeModal}
        />
      ) : null}
    </AppShell>
  );
}

function AttendanceModal({
  activeCell,
  locations,
  onClose,
}: {
  activeCell: ActiveCell;
  locations: Location[];
  onClose: (refresh?: boolean) => Promise<void>;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(activeCell.record?.status ?? "ISDE");
  const [location, setLocation] = useState(activeCell.record?.location ?? "");
  const [actedAsCook, setActedAsCook] = useState(Boolean(activeCell.record?.cookedHeadcount));
  const [cookedHeadcount, setCookedHeadcount] = useState(
    activeCell.record?.cookedHeadcount?.toString() ?? "",
  );
  const [error, setError] = useState("");

  async function saveAttendance() {
    setError("");
    const payload = {
      employeeId: activeCell.employee.id,
      date: activeCell.dateKey,
      status,
      location: status === "EZAMIYYET" ? location : null,
      cookedHeadcount:
        status === "EZAMIYYET" && actedAsCook && cookedHeadcount
          ? Number(cookedHeadcount)
          : null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-950">{activeCell.employee.name}</h2>
            <p className="text-sm text-slate-500">{activeCell.dateKey}</p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => void onClose(false)}
            title="Close"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 px-4 py-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Status
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setStatus(event.target.value as AttendanceStatus)}
              value={status}
            >
              {statuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {status === "EZAMIYYET" ? (
            <>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Location
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                  onChange={(event) => setLocation(event.target.value)}
                  value={location}
                >
                  <option value="">Select location</option>
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
                Acted as cook
              </label>
              {actedAsCook ? (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Cooked for
                  <input
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    min="1"
                    onChange={(event) => setCookedHeadcount(event.target.value)}
                    type="number"
                    value={cookedHeadcount}
                  />
                </label>
              ) : null}
            </>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={deleteAttendance}
            type="button"
          >
            <Trash2 size={16} />
            Clear
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
            onClick={saveAttendance}
            type="button"
          >
            <Check size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
