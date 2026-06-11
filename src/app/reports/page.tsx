"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Download, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { statusKey, useLanguage } from "@/lib/i18n";
import type {
  AttendanceStatus,
  Car,
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

export default function ReportsPage() {
  const { t } = useLanguage();
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [carId, setCarId] = useState("");
  const [weekend, setWeekend] = useState("all");
  const [holiday, setHoliday] = useState("all");
  const [report, setReport] = useState<FilteredReport | null>(null);
  const [error, setError] = useState("");

  const departments = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department))).sort(),
    [employees],
  );
  const rows = useMemo(() => report?.records ?? [], [report]);
  const canDownload = rows.length > 0;
  const byEmployee = useMemo(() => groupByEmployee(rows), [rows]);
  const byLocation = useMemo(() => groupByLocation(rows), [rows]);

  const loadOptions = useCallback(async () => {
    const [employeeResponse, locationResponse, carResponse] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/locations"),
      fetch("/api/cars"),
    ]);

    if (!employeeResponse.ok || !locationResponse.ok || !carResponse.ok) {
      setError("Could not load report options.");
      return;
    }

    setEmployees(await employeeResponse.json());
    setLocations(await locationResponse.json());
    setCars(await carResponse.json());
  }, []);

  const loadReport = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ from, to });

    if (employeeId) {
      params.set("employeeId", employeeId);
    }

    if (department) {
      params.set("department", department);
    }

    if (status) {
      params.set("status", status);
    }

    if (location) {
      params.set("location", location);
    }

    if (carId) {
      params.set("carId", carId);
    }

    if (weekend !== "all") {
      params.set("weekend", weekend);
    }

    if (holiday !== "all") {
      params.set("holiday", holiday);
    }

    const response = await fetch(`/api/reports?${params.toString()}`);

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not load report.");
      return;
    }

    setReport(await response.json());
  }, [carId, department, employeeId, from, holiday, location, status, to, weekend]);

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
    if (!report) {
      return;
    }

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
        ["Cooked For Total", report.summary.cookedHeadcountTotal],
        ["Unique Locations", report.summary.uniqueLocations],
      ]),
      "Summary",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        byEmployee.map((item) => ({
          Employee: item.employeeName,
          Department: item.department,
          Records: item.records,
          "İşdə": item.isdeDays,
          "Ezamiyyət": item.ezamiyyetDays,
          ...statusCountsForExport(item.statusCounts, t),
          "Weekend Worked": item.weekendWorkedDays,
          "Holiday Worked": item.holidayWorkedDays,
          "Cars Driven": item.carsDrivenDays,
          "Cooked For": item.cookedHeadcountTotal,
        })),
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
          "Cooked For": item.cookedHeadcountTotal,
        })),
      ),
      "By Location",
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows(rows, t)), "Records");
    XLSX.writeFile(workbook, `attendance_report_${from}_${to}.xlsx`);
  }

  return (
      <AppShell title={t("reports")} eyebrow={`${from} - ${to}`}>
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4 xl:grid-cols-8"
          onSubmit={submitReport}
        >
          <SelectField label={t("employee")} onChange={setEmployeeId} value={employeeId}>
            <option value="">{t("allEmployees")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} - {employee.department}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("department")} onChange={setDepartment} value={department}>
            <option value="">{t("allDepartments")}</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("status")} onChange={setStatus} value={status}>
            <option value="">{t("allStatuses")}</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {t(statusKey(item))}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("location")} onChange={setLocation} value={location}>
            <option value="">{t("allLocations")}</option>
            {locations.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("cars")} onChange={setCarId} value={carId}>
            <option value="">{t("allCars")}</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.makeModel} - {car.licensePlate}
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Search size={16} />
              {t("run")}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {report ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label={t("records")} value={report.summary.totalRecords} />
              <Metric label={t("employees")} value={report.summary.uniqueEmployees} />
              <Metric label={t("statusISDE")} value={report.summary.isdeDays} />
              <Metric label={t("statusEZAMIYYET")} value={report.summary.ezamiyyetDays} />
              <Metric label={t("carsDriven")} value={report.summary.carsDrivenDays} />
              <Metric label={t("weekend")} value={report.summary.weekendWorkedDays} />
              <Metric label={t("holiday")} value={report.summary.holidayWorkedDays} />
              <Metric label={t("cookedFor")} value={report.summary.cookedHeadcountTotal} />
              <Metric label={t("locations")} value={report.summary.uniqueLocations} />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <BreakdownTable
                emptyText="No employee rows"
                headers={[
                  t("employee"),
                  t("department"),
                  t("records"),
                  ...statusOptions.map((item) => t(statusKey(item))),
                  t("weekend"),
                  t("holiday"),
                  t("cars"),
                  t("cooked"),
                ]}
                rows={byEmployee.map((item) => [
                  item.employeeName,
                  item.department,
                  item.records,
                  ...statusOptions.map((statusOption) => item.statusCounts[statusOption]),
                  item.weekendWorkedDays,
                  item.holidayWorkedDays,
                  item.carsDrivenDays,
                  item.cookedHeadcountTotal,
                ])}
                title={t("byEmployee")}
              />
              <BreakdownTable
                emptyText="No location rows"
                headers={[
                  t("location"),
                  t("records"),
                  t("uniqueDays"),
                  t("employees"),
                  ...statusOptions.map((item) => t(statusKey(item))),
                  t("cars"),
                  t("cooked"),
                ]}
                rows={byLocation.map((item) => [
                  item.location,
                  item.records,
                  item.uniqueDays,
                  item.uniqueEmployees,
                  ...statusOptions.map((statusOption) => item.statusCounts[statusOption]),
                  item.carsDrivenDays,
                  item.cookedHeadcountTotal,
                ])}
                title={t("byLocation")}
              />
            </section>

            <BreakdownTable
              emptyText="No attendance records match these filters"
              headers={[
                t("date"),
                t("employee"),
                t("department"),
                t("status"),
                t("location"),
                t("workLocations"),
                t("cooked"),
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
                row.cookedHeadcount ?? "-",
                row.carDriven ? row.car ?? "Yes" : "-",
                row.note ?? "-",
                row.isWeekend ? "Yes" : "No",
                row.holidayDescription ?? (row.isHoliday ? "Yes" : "No"),
              ])}
              title={t("records")}
            />
          </>
        ) : (
          <EmptyState text="Run a report to see attendance records." />
        )}
      </div>
    </AppShell>
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
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
        onChange={(event) => onChange(event.target.value)}
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
        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        onChange={(event) => onChange(event.target.value)}
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
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              {headers.map((header) => (
                <th className="px-4 py-3 font-semibold text-slate-700" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={headers.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr className="border-b border-slate-100" key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td className="px-4 py-3 text-slate-700" key={`${title}-${rowIndex}-${cellIndex}`}>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
      {text}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function employeeLabel(employees: Employee[], employeeId: string) {
  const employee = employees.find((item) => item.id.toString() === employeeId);
  return employee ? `${employee.name} - ${employee.department}` : "";
}

function carLabel(cars: Car[], carId: string) {
  const car = cars.find((item) => item.id.toString() === carId);
  return car ? `${car.makeModel} - ${car.licensePlate}` : "";
}

function optionLabel(value: string) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

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
    "Cooked For": row.cookedHeadcount ?? "",
    Car: row.carDriven ? row.car ?? "Yes" : "",
    Note: row.note ?? "",
    Weekend: row.isWeekend ? "Yes" : "No",
    Holiday: row.holidayDescription ?? (row.isHoliday ? "Yes" : "No"),
  }));
}

function emptyStatusCounts() {
  return Object.fromEntries(statusOptions.map((item) => [item, 0])) as Record<
    AttendanceStatus,
    number
  >;
}

function statusCountsForExport(
  statusCounts: Record<AttendanceStatus, number>,
  t: (key: string) => string,
) {
  return Object.fromEntries(
    statusOptions.map((item) => [`Status - ${t(statusKey(item))}`, statusCounts[item]]),
  );
}

function groupByEmployee(rows: FilteredReportRow[]) {
  const grouped = new Map<
    number,
    {
      employeeName: string;
      department: string;
      records: number;
      statusCounts: Record<AttendanceStatus, number>;
      isdeDays: number;
      ezamiyyetDays: number;
      weekendWorkedDays: number;
      holidayWorkedDays: number;
      carsDrivenDays: number;
      cookedHeadcountTotal: number;
    }
  >();

  for (const row of rows) {
    const item =
      grouped.get(row.employeeId) ??
      {
        employeeName: row.employeeName,
        department: row.department,
        records: 0,
        statusCounts: emptyStatusCounts(),
        isdeDays: 0,
        ezamiyyetDays: 0,
        weekendWorkedDays: 0,
        holidayWorkedDays: 0,
        carsDrivenDays: 0,
        cookedHeadcountTotal: 0,
      };

    item.records += 1;
    item.statusCounts[row.status] += 1;
    item.isdeDays += row.status === "ISDE" ? 1 : 0;
    item.ezamiyyetDays += row.status === "EZAMIYYET" ? 1 : 0;
    item.weekendWorkedDays += row.isWeekend && isWorked(row.status) ? 1 : 0;
    item.holidayWorkedDays += row.isHoliday && isWorked(row.status) ? 1 : 0;
    item.carsDrivenDays += row.carDriven ? 1 : 0;
    item.cookedHeadcountTotal += row.cookedHeadcount ?? 0;
    grouped.set(row.employeeId, item);
  }

  return Array.from(grouped.values());
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
      cookedHeadcountTotal: number;
    }
  >();

  for (const row of rows) {
    const rowLocations = new Set([
      ...(row.location ? [row.location] : []),
      ...row.workLocations,
    ]);

    for (const rowLocation of rowLocations) {
      const item =
        grouped.get(rowLocation) ??
        {
          location: rowLocation,
          records: 0,
          dates: new Set<string>(),
          employees: new Set<number>(),
          statusCounts: emptyStatusCounts(),
          isdeDays: 0,
          ezamiyyetDays: 0,
          carsDrivenDays: 0,
          cookedHeadcountTotal: 0,
        };

      item.records += 1;
      item.dates.add(row.date);
      item.employees.add(row.employeeId);
      item.statusCounts[row.status] += 1;
      item.isdeDays += row.status === "ISDE" ? 1 : 0;
      item.ezamiyyetDays += row.status === "EZAMIYYET" ? 1 : 0;
      item.carsDrivenDays += row.carDriven ? 1 : 0;
      item.cookedHeadcountTotal += row.cookedHeadcount ?? 0;
      grouped.set(rowLocation, item);
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
    cookedHeadcountTotal: item.cookedHeadcountTotal,
  }));
}

function isWorked(status: AttendanceStatus) {
  return status === "ISDE" || status === "EZAMIYYET" || status === "ISDE_XESARET";
}
