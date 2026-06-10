import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <AppShell title="Attendance Tracker" eyebrow="Employee Timesheet">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          href="/timesheet"
        >
          <h2 className="text-lg font-semibold text-slate-950">Timesheet</h2>
          <p className="mt-2 text-sm text-slate-600">Monthly employee grid.</p>
        </a>
        <a
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          href="/employees"
        >
          <h2 className="text-lg font-semibold text-slate-950">Employees</h2>
          <p className="mt-2 text-sm text-slate-600">Add, edit, and remove employees.</p>
        </a>
        <a
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          href="/holidays"
        >
          <h2 className="text-lg font-semibold text-slate-950">Holidays</h2>
          <p className="mt-2 text-sm text-slate-600">Official holiday CRUD.</p>
        </a>
        <a
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          href="/reports"
        >
          <h2 className="text-lg font-semibold text-slate-950">Reports</h2>
          <p className="mt-2 text-sm text-slate-600">Range-based summaries.</p>
        </a>
        <a
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          href="/locations"
        >
          <h2 className="text-lg font-semibold text-slate-950">Locations</h2>
          <p className="mt-2 text-sm text-slate-600">Ezamiyyet dropdown options.</p>
        </a>
        <a
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          href="/status-colors"
        >
          <h2 className="text-lg font-semibold text-slate-950">Status Colors</h2>
          <p className="mt-2 text-sm text-slate-600">Cell color settings.</p>
        </a>
      </div>
    </AppShell>
  );
}
