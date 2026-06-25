"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Car,
  ChevronDown,
  ClipboardList,
  DatabaseBackup,
  Fuel,
  Home,
  LogOut,
  MapPin,
  MessageSquare,
  Palette,
  Radar,
  ScrollText,
  Shield,
  TrendingUp,
  Umbrella,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { languages, useLanguage } from "@/lib/i18n";

type SessionInfo = { username: string; role: string } | null;

type NavGroup = {
  labelKey: string;
  icon: React.ElementType;
  items: { href: string; labelKey: string; icon: React.ElementType }[];
};

const navGroups: NavGroup[] = [
  {
    labelKey: "davamiyyet",
    icon: CalendarDays,
    items: [
      { href: "/timesheet", labelKey: "timesheet", icon: CalendarDays },
      { href: "/reports", labelKey: "reports", icon: ClipboardList },
      { href: "/reports-v2", labelKey: "reportsV2", icon: TrendingUp },
      { href: "/ai-chat", labelKey: "aiChat", icon: MessageSquare },
    ],
  },
  {
    labelKey: "melumatlar",
    icon: Users,
    items: [
      { href: "/employees", labelKey: "employees", icon: Users },
      { href: "/holidays", labelKey: "holidays", icon: Umbrella },
      { href: "/locations", labelKey: "locations", icon: MapPin },
      { href: "/status-colors", labelKey: "statusColors", icon: Palette },
    ],
  },
  {
    labelKey: "avtopark",
    icon: Car,
    items: [
      { href: "/cars", labelKey: "cars", icon: Car },
      { href: "/maintenance", labelKey: "maintenanceHistory", icon: Wrench },
      { href: "/fuel-report", labelKey: "fuelReport", icon: Fuel },
    ],
  },
];

const adminGroup: NavGroup = {
  labelKey: "admin",
  icon: Shield,
  items: [
    { href: "/users", labelKey: "users", icon: UserCog },
    { href: "/backup", labelKey: "backup", icon: DatabaseBackup },
    { href: "/audit", labelKey: "auditLog", icon: ScrollText },
    { href: "/azpetrol", labelKey: "azpetrol", icon: Fuel },
    { href: "/mission-control", labelKey: "missionControl", icon: Radar },
  ],
};

function pillClass(active = false) {
  return `inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium shadow-sm transition ${
    active
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"
  }`;
}

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
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.username) setSession(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const groups = session?.role === "ADMIN" ? [...navGroups, adminGroup] : navGroups;

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
          <nav ref={navRef} className="flex flex-wrap gap-2">
            <Link href="/" className={pillClass(pathname === "/")}>
              <Home aria-hidden="true" size={16} />
              {t("home")}
            </Link>

            {groups.map((group) => {
              const GroupIcon = group.icon;
              const isOpen = openGroup === group.labelKey;
              const isGroupActive = group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

              return (
                <div key={group.labelKey} className="relative">
                  <button
                    className={pillClass(isGroupActive && !isOpen)}
                    onClick={() => setOpenGroup(isOpen ? null : group.labelKey)}
                    onKeyDown={(e) => { if (e.key === "Escape") setOpenGroup(null); }}
                    aria-expanded={isOpen}
                  >
                    <GroupIcon aria-hidden="true" size={16} />
                    {t(group.labelKey)}
                    <ChevronDown
                      aria-hidden="true"
                      size={14}
                      className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="absolute left-0 top-full z-10 mt-1 min-w-max rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenGroup(null)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${isActive ? "font-semibold text-slate-950 bg-slate-50" : "text-slate-700"}`}
                          >
                            <ItemIcon aria-hidden="true" size={15} />
                            {t(item.labelKey)}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {session?.username && (
              <span className="inline-flex h-10 items-center rounded-md border border-slate-100 bg-slate-50 px-3 text-sm text-slate-400">
                {session.username}
              </span>
            )}

            <label className={pillClass()}>
              {t("language")}
              <select
                className="bg-transparent text-sm outline-none"
                onChange={(e) => setLanguage(e.target.value as typeof language)}
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
              <button className={pillClass()} type="submit">
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
