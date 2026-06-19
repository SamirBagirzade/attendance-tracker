"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, History, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import type { Employee } from "@/types/domain";

export default function EmployeesPage() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ name: "", department: "", vacationLimit: "", sickLimit: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [ytdCounts, setYtdCounts] = useState<Record<number, { xeste: number; mezuniyyet: number }>>({});

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.role === "ADMIN") setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const loadEmployees = useCallback(async () => {
    setError("");
    const [empRes, ytdRes] = await Promise.all([
      fetch("/api/employees"),
      fetch(`/api/employees/summary?year=${new Date().getFullYear()}`),
    ]);

    if (!empRes.ok) {
      setError("Could not load employees.");
      return;
    }

    setEmployees(await empRes.json());

    if (ytdRes.ok) {
      const summary = await ytdRes.json() as { employeeId: number; xeste: number; mezuniyyet: number }[];
      const map: Record<number, { xeste: number; mezuniyyet: number }> = {};
      for (const row of summary) map[row.employeeId] = { xeste: row.xeste, mezuniyyet: row.mezuniyyet };
      setYtdCounts(map);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEmployees();
  }, [loadEmployees]);

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch(editingId ? `/api/employees/${editingId}` : "/api/employees", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not save employee.");
      return;
    }

    setForm({ name: "", department: "", vacationLimit: "", sickLimit: "" });
    setEditingId(null);
    await loadEmployees();
  }

  async function deleteEmployee(id: number) {
    setError("");
    const response = await fetch(`/api/employees/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not delete employee.");
      return;
    }

    await loadEmployees();
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      name: employee.name,
      department: employee.department,
      vacationLimit: employee.vacationLimit?.toString() ?? "",
      sickLimit: employee.sickLimit?.toString() ?? "",
    });
  }

  return (
    <AppShell title={t("employees")} eyebrow={t("employeeTimesheet")}>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form
          className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={saveEmployee}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("name")}
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              value={form.name}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("department")}
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) =>
                setForm((current) => ({ ...current, department: event.target.value }))
              }
              value={form.department}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("vacationLimit")}
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                min="0"
                onChange={(event) => setForm((current) => ({ ...current, vacationLimit: event.target.value }))}
                placeholder={t("noLimit")}
                type="number"
                value={form.vacationLimit}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("sickLimit")}
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                min="0"
                onChange={(event) => setForm((current) => ({ ...current, sickLimit: event.target.value }))}
                placeholder={t("noLimit")}
                type="number"
                value={form.sickLimit}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? t("update") : t("add")}
            </button>
            {editingId ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: "", department: "", vacationLimit: "", sickLimit: "" });
                }}
                type="button"
              >
                <X size={16} />
                {t("cancel")}
              </button>
            ) : null}
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </form>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              value={search}
            />
          </div>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left">
                <tr>
                  {isAdmin && <th className="w-16 px-4 py-3 font-semibold text-slate-700">ID</th>}
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("name")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("department")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">{t("ytdSick")} / {t("ytdVacation")}</th>
                  <th className="w-32 px-4 py-3 text-right font-semibold text-slate-700">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = employees.filter(
                    (e) =>
                      !search ||
                      e.name.toLowerCase().includes(search.toLowerCase()) ||
                      e.department.toLowerCase().includes(search.toLowerCase()),
                  );
                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={isAdmin ? 5 : 4}>
                          {t("noEmployees")}
                        </td>
                      </tr>
                    );
                  }
                  return filtered.map((employee) => {
                    const ytd = ytdCounts[employee.id];
                    return (
                      <tr className="border-b border-slate-100" key={employee.id}>
                        {isAdmin && <td className="px-4 py-3 text-slate-400">{employee.id}</td>}
                        <td className="px-4 py-3 font-medium text-slate-950">{employee.name}</td>
                        <td className="px-4 py-3 text-slate-700">{employee.department}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-500">
                              <span className="text-red-600 font-semibold">{ytd?.xeste ?? 0}</span>
                              {employee.sickLimit != null && (
                                <span className="text-slate-400"> / {employee.sickLimit}</span>
                              )}
                              <span className="ml-1 text-slate-400">{t("ytdSick").split("(")[0].trim()}</span>
                            </span>
                            <span className="text-xs text-slate-500">
                              <span className="text-amber-600 font-semibold">{ytd?.mezuniyyet ?? 0}</span>
                              {employee.vacationLimit != null && (
                                <span className="text-slate-400"> / {employee.vacationLimit}</span>
                              )}
                              <span className="ml-1 text-slate-400">{t("ytdVacation").split("(")[0].trim()}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/employees/${employee.id}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                              title={t("viewHistory")}
                            >
                              <History size={16} />
                            </Link>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                              onClick={() => startEdit(employee)}
                              title={t("edit")}
                              type="button"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-red-600 hover:bg-red-50"
                              onClick={() => void deleteEmployee(employee.id)}
                              title={t("delete")}
                              type="button"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
