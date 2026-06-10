"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Holiday } from "@/types/domain";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [form, setForm] = useState({ date: "", description: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadHolidays = useCallback(async () => {
    setError("");
    const response = await fetch("/api/holidays");

    if (!response.ok) {
      setError("Could not load holidays.");
      return;
    }

    setHolidays(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHolidays();
  }, [loadHolidays]);

  async function saveHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch(editingId ? `/api/holidays/${editingId}` : "/api/holidays", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not save holiday.");
      return;
    }

    setForm({ date: "", description: "" });
    setEditingId(null);
    await loadHolidays();
  }

  async function deleteHoliday(id: number) {
    setError("");
    const response = await fetch(`/api/holidays/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not delete holiday.");
      return;
    }

    await loadHolidays();
  }

  function startEdit(holiday: Holiday) {
    setEditingId(holiday.id);
    setForm({ date: holiday.date, description: holiday.description });
  }

  return (
    <AppShell title="Holiday Management" eyebrow="Official Calendar">
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form
          className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={saveHoliday}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Date
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={form.date}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Description
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              value={form.description}
            />
          </label>
          <div className="flex gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? "Update" : "Add"}
            </button>
            {editingId ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditingId(null);
                  setForm({ date: "", description: "" });
                }}
                type="button"
              >
                <X size={16} />
                Cancel
              </button>
            ) : null}
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Description</th>
                <th className="w-28 px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                    No holidays
                  </td>
                </tr>
              ) : (
                holidays.map((holiday) => (
                  <tr className="border-b border-slate-100" key={holiday.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {holiday.date}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{holiday.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={() => startEdit(holiday)}
                          title="Edit"
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-red-600 hover:bg-red-50"
                          onClick={() => void deleteHoliday(holiday.id)}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
