"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import type { Employee } from "@/types/domain";

type FormResponseRow = {
  id: number;
  employeeId: number;
  employeeName: string;
  activityText: string | null;
  absenceReason: string | null;
  submittedAt: string;
  date: string;
  employee: { name: string; department: string } | null;
};

const PAGE_SIZE = 100;

export default function FormSubmissionsPage() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FormResponseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEmployees(data as Employee[]));
  }, []);

  const runQuery = useCallback(async (p = 0) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (employeeId) params.set("employeeId", employeeId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/forms/daily-log?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Could not load submissions.");
      }
      const data = (await res.json()) as { total: number; page: number; responses: FormResponseRow[] };
      setRows(data.responses);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  }, [employeeId, from, to, q]);

  useEffect(() => {
    void runQuery(0);
  }, [runQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("az-AZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <AppShell eyebrow="Admin" title={t("formSubmissions")}>
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => { e.preventDefault(); void runQuery(0); }}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("employee")}
            <select
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              onChange={(e) => setEmployeeId(e.target.value)}
              value={employeeId}
            >
              <option value="">{t("allEmployees")}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} – {emp.department}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("from")}
            <input
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("to")}
            <input
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(e) => setTo(e.target.value)}
              type="date"
              value={to}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">
            {t("search")}
            <input
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              type="text"
              value={q}
            />
          </label>
          <div className="flex items-end">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Search size={16} />
              {t("run")}
            </button>
          </div>
        </form>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 text-xs text-slate-500">
            <span>{total} {t("records")}</span>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 0}
                onClick={() => void runQuery(page - 1)}
                type="button"
              >
                <ChevronLeft size={14} />
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page + 1 >= totalPages}
                onClick={() => void runQuery(page + 1)}
                type="button"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("employee")}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("department")}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Submitted</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("formSubmission")}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("absenceReason")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>{t("loading")}</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>—</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr className="border-t border-slate-100 hover:bg-slate-50" key={row.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {row.employee?.name ?? row.employeeName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{row.employee?.department ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.date.slice(0, 10)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{formatDateTime(row.submittedAt)}</td>
                      <td className="max-w-xs whitespace-pre-line px-4 py-2.5 text-slate-700">
                        {row.activityText || "—"}
                      </td>
                      <td className="max-w-xs whitespace-pre-line px-4 py-2.5 text-slate-700">
                        {row.absenceReason || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
