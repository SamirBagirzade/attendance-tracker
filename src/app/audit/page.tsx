"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import type { AuditLog } from "@/types/domain";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  RESTORE: "bg-amber-100 text-amber-800",
  UPSERT: "bg-violet-100 text-violet-800",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-slate-900 text-white",
  EDITOR: "bg-slate-200 text-slate-800",
  VIEWER: "bg-slate-100 text-slate-600",
};

const ENTITIES = [
  "Employee",
  "Car",
  "AttendanceRecord",
  "MaintenanceRecord",
  "User",
  "Backup",
];

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  OIL_CHANGE: "Oil Change",
  INSURANCE: "Insurance",
  INSPECTION: "Inspection",
};

function formatDetails(details: string | null): string {
  if (!details) return "";
  try {
    const d = JSON.parse(details) as Record<string, unknown>;

    if (typeof d.name === "string" && typeof d.department === "string")
      return `${d.name} · ${d.department}`;

    if (typeof d.makeModel === "string" && typeof d.licensePlate === "string")
      return `${d.makeModel} · ${d.licensePlate}`;

    if (typeof d.username === "string" && typeof d.role === "string" && d.isActive === undefined)
      return `${d.username} · ${d.role}`;

    if (typeof d.role === "string" && d.isActive !== undefined)
      return `${d.role} · ${d.isActive ? "Active" : "Inactive"}`;

    if (typeof d.employeeId === "number" && typeof d.date === "string" && typeof d.status === "string")
      return `Employee #${d.employeeId} · ${d.date} · ${d.status}`;

    if (typeof d.status === "string" && typeof d.date === "string")
      return `${d.date} · ${d.status}`;

    if (typeof d.carId === "number" && typeof d.type === "string" && typeof d.date === "string")
      return `Car #${d.carId} · ${MAINTENANCE_TYPE_LABELS[d.type] ?? d.type} · ${d.date}`;

    if (typeof d.exportedAt === "string")
      return `Exported ${d.exportedAt.slice(0, 10)}`;

    return JSON.stringify(d);
  } catch {
    return details;
  }
}

function parseDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function DetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsed = parseDetails(log.details);

  function formatValue(val: unknown): string {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Active" : "Inactive";
    if (typeof val === "string" && val in MAINTENANCE_TYPE_LABELS)
      return MAINTENANCE_TYPE_LABELS[val];
    return String(val);
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"}`}>
              {log.action}
            </span>
            <span className="text-slate-800 font-medium">{log.entity}</span>
            {log.entityId && <span className="text-slate-400 text-sm">#{log.entityId}</span>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 w-16 shrink-0">User</span>
            <span className="font-medium">{log.username}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ROLE_COLORS[log.role] ?? "bg-slate-100 text-slate-700"}`}>
              {log.role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 w-16 shrink-0">Time</span>
            <span className="text-slate-700">{new Date(log.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {parsed && (
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Details</p>
            {Object.entries(parsed).map(([key, val]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="text-slate-500 w-28 shrink-0 capitalize">
                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </span>
                <span className="text-slate-800 break-all">{formatValue(val)}</span>
              </div>
            ))}
          </div>
        )}

        {!parsed && log.details && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Details</p>
            <p className="text-sm text-slate-700 break-all">{log.details}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditPage() {
  const { t } = useLanguage();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const [username, setUsername] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function runQuery() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (username.trim()) params.set("username", username.trim());
      if (entity) params.set("entity", entity);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("az-AZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <AppShell title={t("auditLog")} eyebrow="Admin">
      {selectedLog && (
        <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">{t("username")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("username")}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Entity</label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">All</option>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">{t("from")}</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">{t("to")}</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <button
            onClick={() => void runQuery()}
            disabled={loading}
            className="rounded bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? t("loading") : t("run")}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("date")}</th>
                <th className="px-3 py-2">{t("username")}</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{t("details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    {loading ? t("loading") + "..." : "No records"}
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const summary = formatDetails(log.details);
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium">{log.username}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ROLE_COLORS[log.role] ?? "bg-slate-100 text-slate-700"}`}>
                        {log.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{log.entity}</td>
                    <td className="px-3 py-2 text-slate-500">{log.entityId ?? "—"}</td>
                    <td className="px-3 py-2 max-w-xs">
                      {summary ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="block w-full text-left truncate text-slate-600 underline decoration-dotted underline-offset-2 cursor-pointer hover:text-slate-900"
                        >
                          {summary}
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {logs.length > 0 && (
          <p className="text-xs text-slate-400">{logs.length} records (max 500)</p>
        )}
      </div>
    </AppShell>
  );
}
