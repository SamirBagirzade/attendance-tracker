"use client";

import { useEffect, useState } from "react";
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

export default function AuditPage() {
  const { t } = useLanguage();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

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
              {logs.map((log) => (
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
                    {log.details ? (
                      <span
                        title={log.details}
                        className="block truncate text-slate-500 cursor-default"
                      >
                        {log.details}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
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
