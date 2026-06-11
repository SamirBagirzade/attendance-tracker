"use client";

import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

const cards = [
  { href: "/timesheet", title: "timesheet", text: "monthlyEmployeeGrid" },
  { href: "/employees", title: "employees", text: "addEditRemoveEmployees" },
  { href: "/holidays", title: "holidays", text: "officialHolidayCrud" },
  { href: "/reports", title: "reports", text: "rangeBasedSummaries" },
  { href: "/locations", title: "locations", text: "locationOptions" },
  { href: "/cars", title: "cars", text: "fleet" },
  { href: "/status-colors", title: "statusColors", text: "cellColorSettings" },
];

export default function Home() {
  const { t } = useLanguage();

  return (
    <AppShell title={t("attendanceTracker")} eyebrow={t("employeeTimesheet")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <a
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
            href={card.href}
            key={card.href}
          >
            <h2 className="text-lg font-semibold text-slate-950">{t(card.title)}</h2>
            <p className="mt-2 text-sm text-slate-600">{t(card.text)}</p>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
