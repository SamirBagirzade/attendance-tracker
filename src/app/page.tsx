"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CalendarDays, Car, ChevronRight, ClipboardList, MapPin, Palette, Users, Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

const STATUS_COLORS: Record<string, string> = {
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

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  OIL_CHANGE: "Oil",
  INSURANCE: "Insurance",
  INSPECTION: "Inspection",
};

type DashboardData = {
  totalEmployees: number;
  employeesWithoutRecord: number;
  statusCounts: Record<string, number>;
  maintenanceAlerts: { id: number; makeModel: string; licensePlate: string; type: string; severity: "warning" | "overdue" }[];
};

const NAV_CARDS = [
  { href: "/timesheet", icon: CalendarDays, title: "timesheet", text: "monthlyEmployeeGrid" },
  { href: "/employees", icon: Users, title: "employees", text: "addEditRemoveEmployees" },
  { href: "/holidays", icon: CalendarCheck, title: "holidays", text: "officialHolidayCrud" },
  { href: "/reports", icon: ClipboardList, title: "reports", text: "rangeBasedSummaries" },
  { href: "/locations", icon: MapPin, title: "locations", text: "locationOptions" },
  { href: "/cars", icon: Car, title: "cars", text: "fleet" },
  { href: "/status-colors", icon: Palette, title: "statusColors", text: "cellColorSettings" },
  { href: "/maintenance", icon: Wrench, title: "maintenanceHistory", text: "maintenanceHistory" },
];

export default function Home() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d as DashboardData); })
      .catch(() => {});
  }, []);

  const statusEntries = data
    ? Object.entries(data.statusCounts).sort((a, b) => b[1] - a[1])
    : [];
  const totalRecords = statusEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <AppShell title={t("attendanceTracker")} eyebrow={t("employeeTimesheet")}>
      <div className="grid gap-6">

        {/* Live stats row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {/* Today's attendance */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm col-span-full lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("todayAttendance")}</h2>
              {data && (
                <span className="text-xs text-slate-400">
                  {totalRecords}/{data.totalEmployees} {t("employees")}
                </span>
              )}
            </div>
            {!data ? (
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            ) : statusEntries.length === 0 ? (
              <p className="text-sm text-slate-400">{t("withoutRecord")}: {data.totalEmployees}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {statusEntries.map(([status, count]) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white"
                    style={{ backgroundColor: STATUS_COLORS[status] ?? "#94a3b8" }}
                  >
                    {t(`status${status}`)}
                    <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-xs">{count}</span>
                  </span>
                ))}
                {data.employeesWithoutRecord > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
                    {t("withoutRecord")}
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs">{data.employeesWithoutRecord}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Maintenance alerts */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("maintenanceAlerts")}</h2>
            {!data ? (
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            ) : data.maintenanceAlerts.length === 0 ? (
              <p className="text-sm text-slate-400">{t("noAlertsToday")}</p>
            ) : (
              <div className="space-y-2">
                {data.maintenanceAlerts.map((alert, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${alert.severity === "overdue" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                    <AlertTriangle size={13} className="shrink-0" />
                    <span className="truncate">{alert.makeModel} · {alert.licensePlate}</span>
                    <span className="ml-auto shrink-0">{MAINTENANCE_TYPE_LABELS[alert.type] ?? alert.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                href={card.href}
                key={card.href}
              >
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 group-hover:bg-slate-100">
                  <Icon size={18} className="text-slate-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-950">{t(card.title)}</h2>
                  <p className="mt-0.5 text-xs text-slate-500 leading-snug">{t(card.text)}</p>
                </div>
                <ChevronRight size={16} className="ml-auto mt-1 shrink-0 text-slate-300 group-hover:text-slate-500" />
              </Link>
            );
          })}
        </div>

      </div>
    </AppShell>
  );
}
