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
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/timesheet", label: "Timesheet", icon: CalendarDays },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/holidays", label: "Holidays", icon: Umbrella },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/cars", label: "Cars", icon: Car },
  { href: "/status-colors", label: "Status Colors", icon: Palette },
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/users", label: "Users", icon: UserCog },
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
                  {item.label}
                </Link>
              );
            })}
            <form action="/api/auth/logout" method="post">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                type="submit"
              >
                <LogOut aria-hidden="true" size={16} />
                Logout
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}
