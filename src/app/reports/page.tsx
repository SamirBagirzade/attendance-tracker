"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Download, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type {
  AttendanceStatus,
  Employee,
  FilteredReport,
  FilteredReportRow,
  Location,
} from "@/types/domain";

const statusOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "ISDE", label: "İşdə" },
  { value: "EZAMIYYET", label: "Ezamiyyət" },
  { value: "MEZUNIYYET", label: "Məzuniyyət" },
  { value: "XESTE", label: "Xəstə" },
  { value: "BAYRAM", label: "Bayram" },
  { value: "ICAZELI", label: "İcazəli" },
  { value: "ISTIRAHET", label: "İstirahət" },
  { value: "ISDE_DEYIL", label: "İşdə deyil" },
];

const statusLabels = Object.fromEntries(
  statusOptions.map((item) => [item.value, item.label]),
) as Record<AttendanceStatus, string>;

export default function ReportsPage() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
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
    const [employeeResponse, locationResponse] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/locations"),
    ]);

    if (!employeeResponse.ok || !locationResponse.ok) {
      setError("Could not load report options.");
      return;
    }

    setEmployees(await employeeResponse.json());
    setLocations(await locationResponse.json());
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
  }, [department, employeeId, from, holiday, location, status, to, weekend]);

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
        ["Status", status ? statusLabels[status as AttendanceStatus] : "All"],
        ["Location", location || "All"],
        ["Weekend", optionLabel(weekend)],
        ["Holiday", optionLabel(holiday)],
        ["Total Records", report.summary.totalRecords],
        ["Unique Employees", report.summary.uniqueEmployees],
        ["İşdə Days", report.summary.isdeDays],
        ["Ezamiyyət Days", report.summary.ezamiyyetDays],
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
          "Weekend Worked": item.weekendWorkedDays,
          "Holiday Worked": item.holidayWorkedDays,
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
          "Cooked For": item.cookedHeadcountTotal,
        })),
      ),
      "By Location",
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows(rows)), "Records");
    XLSX.writeFile(workbook, `attendance_report_${from}_${to}.xlsx`);
  }

  return (
    <AppShell title="Reports" eyebrow={`${from} to ${to}`}>
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4 xl:grid-cols-8"
          onSubmit={submitReport}
        >
          <SelectField label="Employee" onChange={setEmployeeId} value={employeeId}>
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} - {employee.department}
              </option>
            ))}
          </SelectField>
          <SelectField label="Department" onChange={setDepartment} value={department}>
            <option value="">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status" onChange={setStatus} value={status}>
            <option value="">All statuses</option>
            {statusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Location" onChange={setLocation} value={location}>
            <option value="">All locations</option>
            {locations.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Weekend" onChange={setWeekend} value={weekend}>
            <option value="all">All days</option>
            <option value="yes">Only weekend</option>
            <option value="no">Exclude weekend</option>
          </SelectField>
          <SelectField label="Holiday" onChange={setHoliday} value={holiday}>
            <option value="all">All days</option>
            <option value="yes">Only holiday</option>
            <option value="no">Exclude holiday</option>
          </SelectField>
          <DateField label="From" onChange={setFrom} value={from} />
          <DateField label="To" onChange={setTo} value={to} />
          <div className="flex items-end gap-2 lg:col-span-4 xl:col-span-8">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Search size={16} />
              Run
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canDownload}
              onClick={() => void downloadExcel()}
              type="button"
            >
              <Download size={16} />
              Excel
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
              <Metric label="Records" value={report.summary.totalRecords} />
              <Metric label="Employees" value={report.summary.uniqueEmployees} />
              <Metric label="İşdə" value={report.summary.isdeDays} />
              <Metric label="Ezamiyyət" value={report.summary.ezamiyyetDays} />
              <Metric label="Weekend Worked" value={report.summary.weekendWorkedDays} />
              <Metric label="Holiday Worked" value={report.summary.holidayWorkedDays} />
              <Metric label="Cooked For" value={report.summary.cookedHeadcountTotal} />
              <Metric label="Locations" value={report.summary.uniqueLocations} />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <BreakdownTable
                emptyText="No employee rows"
                headers={[
                  "Employee",
                  "Department",
                  "Records",
                  "İşdə",
                  "Ezamiyyət",
                  "Weekend",
                  "Holiday",
                  "Cooked",
                ]}
                rows={byEmployee.map((item) => [
                  item.employeeName,
                  item.department,
                  item.records,
                  item.isdeDays,
                  item.ezamiyyetDays,
                  item.weekendWorkedDays,
                  item.holidayWorkedDays,
                  item.cookedHeadcountTotal,
                ])}
                title="By Employee"
              />
              <BreakdownTable
                emptyText="No location rows"
                headers={[
                  "Location",
                  "Records",
                  "Unique Days",
                  "Employees",
                  "İşdə",
                  "Ezamiyyət",
                  "Cooked",
                ]}
                rows={byLocation.map((item) => [
                  item.location,
                  item.records,
                  item.uniqueDays,
                  item.uniqueEmployees,
                  item.isdeDays,
                  item.ezamiyyetDays,
                  item.cookedHeadcountTotal,
                ])}
                title="By Location"
              />
            </section>

            <BreakdownTable
              emptyText="No attendance records match these filters"
              headers={[
                "Date",
                "Employee",
                "Department",
                "Status",
                "Location",
                "Work Locations",
                "Cooked",
                "Weekend",
                "Holiday",
              ]}
              rows={rows.map((row) => [
                row.date,
                row.employeeName,
                row.department,
                statusLabels[row.status],
                row.location ?? "-",
                row.workLocations.join(", ") || "-",
                row.cookedHeadcount ?? "-",
                row.isWeekend ? "Yes" : "No",
                row.holidayDescription ?? (row.isHoliday ? "Yes" : "No"),
              ])}
              title="Records"
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

function optionLabel(value: string) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  return "All";
}

function exportRows(rows: FilteredReportRow[]) {
  return rows.map((row) => ({
    Date: row.date,
    Employee: row.employeeName,
    Department: row.department,
    Status: statusLabels[row.status],
    Location: row.location ?? "",
    "Work Locations": row.workLocations.join(", "),
    "Cooked For": row.cookedHeadcount ?? "",
    Weekend: row.isWeekend ? "Yes" : "No",
    Holiday: row.holidayDescription ?? (row.isHoliday ? "Yes" : "No"),
  }));
}

function groupByEmployee(rows: FilteredReportRow[]) {
  const grouped = new Map<
    number,
    {
      employeeName: string;
      department: string;
      records: number;
      isdeDays: number;
      ezamiyyetDays: number;
      weekendWorkedDays: number;
      holidayWorkedDays: number;
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
        isdeDays: 0,
        ezamiyyetDays: 0,
        weekendWorkedDays: 0,
        holidayWorkedDays: 0,
        cookedHeadcountTotal: 0,
      };

    item.records += 1;
    item.isdeDays += row.status === "ISDE" ? 1 : 0;
    item.ezamiyyetDays += row.status === "EZAMIYYET" ? 1 : 0;
    item.weekendWorkedDays += row.isWeekend && isWorked(row.status) ? 1 : 0;
    item.holidayWorkedDays += row.isHoliday && isWorked(row.status) ? 1 : 0;
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
      isdeDays: number;
      ezamiyyetDays: number;
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
          isdeDays: 0,
          ezamiyyetDays: 0,
          cookedHeadcountTotal: 0,
        };

      item.records += 1;
      item.dates.add(row.date);
      item.employees.add(row.employeeId);
      item.isdeDays += row.status === "ISDE" ? 1 : 0;
      item.ezamiyyetDays += row.status === "EZAMIYYET" ? 1 : 0;
      item.cookedHeadcountTotal += row.cookedHeadcount ?? 0;
      grouped.set(rowLocation, item);
    }
  }

  return Array.from(grouped.values()).map((item) => ({
    location: item.location,
    records: item.records,
    uniqueDays: item.dates.size,
    uniqueEmployees: item.employees.size,
    isdeDays: item.isdeDays,
    ezamiyyetDays: item.ezamiyyetDays,
    cookedHeadcountTotal: item.cookedHeadcountTotal,
  }));
}

function isWorked(status: AttendanceStatus) {
  return status === "ISDE" || status === "EZAMIYYET";
}
