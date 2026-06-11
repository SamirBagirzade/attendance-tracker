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
import type { Locale } from "date-fns";
import { az, enUS, ru } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { statusKey, useLanguage } from "@/lib/i18n";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Car,
  Employee,
  Holiday,
  Location,
  StatusColor,
} from "@/types/domain";

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
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ name: "", department: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        carResponse,
        statusColorResponse,
      ] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/holidays?from=${from}&to=${to}`),
        fetch(`/api/attendance-records?from=${from}&to=${to}`),
        fetch("/api/locations"),
        fetch("/api/cars"),
        fetch("/api/status-colors"),
      ]);

      if (
        !employeeResponse.ok ||
        !holidayResponse.ok ||
        !recordResponse.ok ||
        !locationResponse.ok ||
        !carResponse.ok ||
        !statusColorResponse.ok
      ) {
        throw new Error("Could not load timesheet data.");
      }

      setEmployees(await employeeResponse.json());
      setHolidays(await holidayResponse.json());
      setRecords(await recordResponse.json());
      setLocations(await locationResponse.json());
      setCars(await carResponse.json());
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
    <AppShell title={t("timesheet")} eyebrow={format(month, "MMMM yyyy", { locale: dateLocale })}>
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
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-56 border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                    {t("employee")}
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
                        <div className="text-[11px] font-medium uppercase">{format(day, "EEE", { locale: dateLocale })}</div>
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
                        const workLocationText =
                          record?.status === "ISDE"
                            ? record.workLocations.map((item) => item.name).join(", ")
                            : "";
                        const carText = record?.carDriven && record.car ? record.car.licensePlate : "";

                        return (
                          <td
                            className={`border-r border-slate-100 p-1 ${base}`}
                            key={dateKey}
                            style={{ minWidth: cellWidth, width: cellWidth }}
                          >
                            <button
                              className="flex min-h-14 w-full flex-col items-center justify-center rounded-md border border-transparent px-1 py-1 text-center text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-white"
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
                              {workLocationText ? (
                                <span className="max-w-full truncate text-[10px] font-medium text-slate-700">
                                  {workLocationText}
                                </span>
                              ) : null}
                              {record?.cookedHeadcount ? (
                                <span className="text-[10px] text-emerald-700">
                                  Cook: {record.cookedHeadcount}
                                </span>
                              ) : null}
                              {carText ? (
                                <span className="max-w-full truncate text-[10px] font-medium text-slate-700">
                                  Car: {carText}
                                </span>
                              ) : null}
                              {record?.note ? (
                                <span className="max-w-full truncate text-[10px] font-medium text-red-700">
                                  Note
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
          cars={cars}
          dateLocale={dateLocale}
          locations={locations}
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
  locations,
  onClose,
}: {
  activeCell: ActiveCell;
  cars: Car[];
  dateLocale: Locale;
  locations: Location[];
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
  const [carDriven, setCarDriven] = useState(Boolean(activeCell.record?.carDriven));
  const [carId, setCarId] = useState(activeCell.record?.carId?.toString() ?? "");
  const [note, setNote] = useState(activeCell.record?.note ?? "");
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
    const payload = {
      employeeId: activeCell.employee.id,
      date: activeCell.dateKey,
      status,
      location: status === "EZAMIYYET" ? location : null,
      workLocationIds: status === "ISDE" ? workLocationIds : [],
      newWorkLocationNames: status === "ISDE" ? newWorkLocationNames : [],
      carDriven: canSelectCar ? carDriven : false,
      carId: canSelectCar && carDriven ? Number(carId) : null,
      note: status === "ISDE_XESARET" ? note : null,
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
        <div className="grid gap-4 px-4 py-4">
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
                    {cars.map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.makeModel} - {car.licensePlate}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {status === "ISDE_XESARET" ? (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("note")}
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
                value={note}
              />
            </label>
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
            {t("clear")}
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
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
