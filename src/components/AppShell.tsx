"use client";

import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Home,
  MapPin,
  Palette,
  Umbrella,
  Users,
  LogOut,
  UserCog,
  Car,
  DatabaseBackup,
} from "lucide-react";
import { languages, useLanguage } from "@/lib/i18n";

const navItems = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/timesheet", labelKey: "timesheet", icon: CalendarDays },
  { href: "/employees", labelKey: "employees", icon: Users },
  { href: "/holidays", labelKey: "holidays", icon: Umbrella },
  { href: "/locations", labelKey: "locations", icon: MapPin },
  { href: "/cars", labelKey: "cars", icon: Car },
  { href: "/status-colors", labelKey: "statusColors", icon: Palette },
  { href: "/reports", labelKey: "reports", icon: ClipboardList },
  { href: "/backup", labelKey: "backup", icon: DatabaseBackup },
  { href: "/users", labelKey: "users", icon: UserCog },
];

export function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                  href={item.href}
                >
                  <Icon aria-hidden="true" size={16} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
            <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
              {t("language")}
              <select
                className="bg-transparent text-sm outline-none"
                onChange={(event) => setLanguage(event.target.value as typeof language)}
                value={language}
              >
                {languages.map((item) => (
                  <option key={item} value={item}>
                    {t(item)}
                  </option>
                ))}
              </select>
            </label>
            <form action="/api/auth/logout" method="post">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                type="submit"
              >
                <LogOut aria-hidden="true" size={16} />
                {t("logout")}
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}
