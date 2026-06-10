"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Download, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Employee, Location, LocationReport, PersonReport } from "@/types/domain";

const statusLabels = {
  ISDE: "Isde",
  EZAMIYYET: "Ezamiyyet",
  MEZUNIYYET: "Mezuniyyet",
  XESTE: "Xeste",
};

type ReportMode = "employee" | "location";

export default function ReportsPage() {
  const [mode, setMode] = useState<ReportMode>("employee");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [location, setLocation] = useState("");
  const [personReports, setPersonReports] = useState<PersonReport[]>([]);
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);
  const [error, setError] = useState("");

  const selectedPersonReport = useMemo(() => personReports[0] ?? null, [personReports]);
  const canDownload =
    mode === "employee" ? Boolean(selectedPersonReport) : locationReports.length > 0;

  const loadOptions = useCallback(async () => {
    const [employeeResponse, locationResponse] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/locations"),
    ]);

    if (!employeeResponse.ok || !locationResponse.ok) {
      setError("Could not load report options.");
      return;
    }

    const nextEmployees: Employee[] = await employeeResponse.json();
    const nextLocations: Location[] = await locationResponse.json();
    setEmployees(nextEmployees);
    setLocations(nextLocations);
    setEmployeeId((current) => current || nextEmployees[0]?.id.toString() || "");
  }, []);

  const loadReport = useCallback(async () => {
    setError("");

    if (mode === "employee") {
      if (!employeeId) {
        setPersonReports([]);
        return;
      }

      const response = await fetch(
        `/api/reports?mode=employee&from=${from}&to=${to}&employeeId=${employeeId}`,
      );

      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Could not load employee report.");
        return;
      }

      setPersonReports(await response.json());
      return;
    }

    const locationParam = location ? `&location=${encodeURIComponent(location)}` : "";
    const response = await fetch(
      `/api/reports?mode=location&from=${from}&to=${to}${locationParam}`,
    );

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not load location report.");
      return;
    }

    setLocationReports(await response.json());
  }, [employeeId, from, location, mode, to]);

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
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();

    if (mode === "employee" && selectedPersonReport) {
      const summaryRows = [
        ["Employee", selectedPersonReport.employeeName],
        ["Department", selectedPersonReport.department],
        ["From", from],
        ["To", to],
        ["Ezamiyyet days", selectedPersonReport.ezamiyyetDays],
        ["Weekend worked", selectedPersonReport.weekendWorkedDays],
        ["Holiday worked", selectedPersonReport.holidayWorkedDays],
        ["Cooked for total", selectedPersonReport.cookedHeadcountTotal],
        [
          "Ezamiyyet by location",
          Object.entries(selectedPersonReport.ezamiyyetByLocation)
            .map(([itemLocation, count]) => `${itemLocation}: ${count}`)
            .join(", ") || "-",
        ],
      ];
      const detailRows = selectedPersonReport.records.map((record) => ({
        Date: record.date,
        Status: statusLabels[record.status],
        Location: record.location ?? "",
        "Cooked For": record.cookedHeadcount ?? "",
        Weekend: record.isWeekend ? "Yes" : "No",
        Holiday: record.holidayDescription ?? (record.isHoliday ? "Yes" : "No"),
      }));

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "Daily Records");
      XLSX.writeFile(
        workbook,
        `${selectedPersonReport.employeeName.replaceAll(" ", "_")}_${from}_${to}_report.xlsx`,
      );
      return;
    }

    if (mode === "location" && locationReports.length > 0) {
      const summaryRows = locationReports.map((report) => ({
        Location: report.location,
        "Ezamiyyet Days": report.ezamiyyetDays,
        "Unique Days": report.uniqueDays,
        Employees: report.employeeCount,
        "Weekend Worked": report.weekendWorkedDays,
        "Holiday Worked": report.holidayWorkedDays,
        "Cooked For": report.cookedHeadcountTotal,
        "Days By Employee":
          Object.entries(report.daysByEmployee)
            .map(([employeeName, count]) => `${employeeName}: ${count}`)
            .join(", ") || "-",
      }));
      const detailRows = locationReports.flatMap((report) =>
        report.records.map((record) => ({
          Location: report.location,
          Date: record.date,
          Employee: record.employeeName,
          Department: record.department,
          "Cooked For": record.cookedHeadcount ?? "",
          Weekend: record.isWeekend ? "Yes" : "No",
          Holiday: record.holidayDescription ?? (record.isHoliday ? "Yes" : "No"),
        })),
      );

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "Daily Records");
      XLSX.writeFile(
        workbook,
        `${(location || "all_locations").replaceAll(" ", "_")}_${from}_${to}_report.xlsx`,
      );
    }
  }

  return (
    <AppShell title={mode === "employee" ? "Person Report" : "Location Report"} eyebrow={`${from} to ${to}`}>
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[auto_minmax(220px,1fr)_auto_auto_auto]"
          onSubmit={submitReport}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Mode
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setMode(event.target.value as ReportMode)}
              value={mode}
            >
              <option value="employee">By Employee</option>
              <option value="location">By Location</option>
            </select>
          </label>
          {mode === "employee" ? (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Employee
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                onChange={(event) => setEmployeeId(event.target.value)}
                value={employeeId}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} - {employee.department}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Location
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                onChange={(event) => setLocation(event.target.value)}
                value={location}
              >
                <option value="">All locations</option>
                {locations.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            From
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            To
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </label>
          <div className="flex items-end gap-2">
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

        {mode === "employee" ? (
          <PersonReportView report={selectedPersonReport} />
        ) : (
          <LocationReportView reports={locationReports} />
        )}
      </div>
    </AppShell>
  );
}

function PersonReportView({ report }: { report: PersonReport | null }) {
  if (!report) {
    return (
      <EmptyState text="Select an employee to generate a report." />
    );
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Ezamiyyet" value={report.ezamiyyetDays} />
        <Metric label="Weekend Worked" value={report.weekendWorkedDays} />
        <Metric label="Holiday Worked" value={report.holidayWorkedDays} />
        <Metric label="Cooked For" value={report.cookedHeadcountTotal} />
        <Metric
          label="Locations"
          value={
            Object.entries(report.ezamiyyetByLocation)
              .map(([itemLocation, count]) => `${itemLocation}: ${count}`)
              .join(", ") || "-"
          }
        />
      </section>
      <ReportTable
        title={report.employeeName}
        subtitle={report.department}
        headers={["Date", "Status", "Location", "Cooked For", "Weekend", "Holiday"]}
        emptyText="No attendance records in this range"
        rows={report.records.map((record) => [
          record.date,
          statusLabels[record.status],
          record.location ?? "-",
          record.cookedHeadcount ?? "-",
          record.isWeekend ? "Yes" : "No",
          record.holidayDescription ?? (record.isHoliday ? "Yes" : "No"),
        ])}
      />
    </>
  );
}

function LocationReportView({ reports }: { reports: LocationReport[] }) {
  if (reports.length === 0) {
    return <EmptyState text="No Ezamiyyet records found for this location and date range." />;
  }

  const totals = reports.reduce(
    (acc, report) => ({
      ezamiyyetDays: acc.ezamiyyetDays + report.ezamiyyetDays,
      employeeCount: acc.employeeCount + report.employeeCount,
      uniqueDays: acc.uniqueDays + report.uniqueDays,
      weekendWorkedDays: acc.weekendWorkedDays + report.weekendWorkedDays,
      holidayWorkedDays: acc.holidayWorkedDays + report.holidayWorkedDays,
      cookedHeadcountTotal: acc.cookedHeadcountTotal + report.cookedHeadcountTotal,
    }),
    {
      ezamiyyetDays: 0,
      employeeCount: 0,
      uniqueDays: 0,
      weekendWorkedDays: 0,
      holidayWorkedDays: 0,
      cookedHeadcountTotal: 0,
    },
  );

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Ezamiyyet" value={totals.ezamiyyetDays} />
        <Metric label="Unique Days" value={totals.uniqueDays} />
        <Metric label="Employees" value={totals.employeeCount} />
        <Metric label="Weekend Worked" value={totals.weekendWorkedDays} />
        <Metric label="Holiday Worked" value={totals.holidayWorkedDays} />
      </section>
      {reports.map((report) => (
        <ReportTable
          key={report.location}
          title={report.location}
          subtitle={
            `Unique days: ${report.uniqueDays}; employees: ${
              Object.entries(report.daysByEmployee)
                .map(([employeeName, count]) => `${employeeName}: ${count}`)
                .join(", ") || "-"
            }`
          }
          headers={["Date", "Employee", "Department", "Cooked For", "Weekend", "Holiday"]}
          emptyText="No records"
          rows={report.records.map((record) => [
            record.date,
            record.employeeName,
            record.department,
            record.cookedHeadcount ?? "-",
            record.isWeekend ? "Yes" : "No",
            record.holidayDescription ?? (record.isHoliday ? "Yes" : "No"),
          ])}
        />
      ))}
    </>
  );
}

function ReportTable({
  title,
  subtitle,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
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
