"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Plus, StickyNote, Trash2, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Field = { id: number; name: string; value: string };

export function CustomFieldsSection({ carId, employeeId }: { carId?: number; employeeId?: number }) {
  const { t } = useLanguage();
  const [fields, setFields] = useState<Field[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const listUrl = carId
    ? `/api/cars/${carId}/fields`
    : `/api/employees/${employeeId}/fields`;

  useEffect(() => {
    fetch(listUrl)
      .then((r) => r.json())
      .then((data) => setFields(data.fields ?? []))
      .catch(() => {});
  }, [listUrl]);

  async function add() {
    if (!name.trim() || !value.trim()) return;
    setError("");
    try {
      const body: Record<string, unknown> = { name: name.trim(), value: value.trim() };
      if (carId) body.carId = carId;
      if (employeeId) body.employeeId = employeeId;
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setFields((prev) => [...prev, json.field]);
      setName("");
      setValue("");
    } catch (err) {
      setError(String(err));
    }
  }

  async function saveEdit(id: number) {
    if (!editValue.trim()) return;
    const res = await fetch(`/api/custom-fields/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: editValue.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      setFields((prev) => prev.map((f) => (f.id === id ? json.field : f)));
      setEditId(null);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setFields((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="mt-5 pt-5 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote size={14} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">{t("customFields")}</h3>
      </div>

      {/* Add form */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("fieldName")}
          className="h-9 w-36 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          placeholder={t("fieldValue")}
          className="h-9 w-48 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button
          onClick={() => void add()}
          disabled={!name.trim() || !value.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-800 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <Plus size={13} />
          {t("add")}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {fields.length === 0 ? (
        <p className="text-xs text-slate-400">{t("noFields")}</p>
      ) : (
        <div className="space-y-1.5">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700 min-w-[80px] shrink-0">{f.name}</span>
              <span className="text-slate-400 text-sm shrink-0">·</span>
              {editId === f.id ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit(f.id);
                      if (e.key === "Escape") setEditId(null);
                    }}
                    className="flex-1 h-7 rounded border border-slate-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <button onClick={() => void saveEdit(f.id)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-800">{f.value}</span>
                  <button
                    onClick={() => { setEditId(f.id); setEditValue(f.value); }}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition"
                    title={t("edit")}
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => void remove(f.id)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition"
                    title={t("delete")}
                  >
                    <Trash2 size={11} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
