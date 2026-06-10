export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Employee Timesheet
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Attendance Tracker
        </h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <a
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          href="/timesheet"
        >
          <h2 className="text-lg font-semibold text-slate-950">Timesheet</h2>
          <p className="mt-2 text-sm text-slate-600">Monthly employee grid.</p>
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
      </div>
    </main>
  );
}
