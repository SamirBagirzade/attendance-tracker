"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Employee } from "@/types/domain";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ name: "", department: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    setError("");
    const response = await fetch("/api/employees");

    if (!response.ok) {
      setError("Could not load employees.");
      return;
    }

    setEmployees(await response.json());
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

    setForm({ name: "", department: "" });
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
    setForm({ name: employee.name, department: employee.department });
  }

  return (
    <AppShell title="Employee Management" eyebrow="People">
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form
          className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={saveEmployee}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Name
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              value={form.name}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Department
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) =>
                setForm((current) => ({ ...current, department: event.target.value }))
              }
              value={form.department}
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
                  setForm({ name: "", department: "" });
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
                <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Department</th>
                <th className="w-28 px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                    No employees
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr className="border-b border-slate-100" key={employee.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{employee.name}</td>
                    <td className="px-4 py-3 text-slate-700">{employee.department}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={() => startEdit(employee)}
                          title="Edit"
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-red-600 hover:bg-red-50"
                          onClick={() => void deleteEmployee(employee.id)}
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
