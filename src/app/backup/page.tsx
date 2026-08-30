"use client";

import { useState } from "react";
import { DatabaseBackup, Terminal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

const restoreCommands = `sudo systemctl stop attendance-tracker
pg_restore --clean --if-exists --no-owner --no-privileges \\
  -d "postgresql://attendance:PASSWORD@localhost:5432/attendance_tracker" \\
  attendance-tracker-YYYY-MM-DD-HHMM.dump
sudo systemctl start attendance-tracker`;

export default function BackupPage() {
  const { t } = useLanguage();
  const [backupStatus, setBackupStatus] = useState("");
  const [error, setError] = useState("");
  const [isBackingUp, setIsBackingUp] = useState(false);

  async function downloadBackup() {
    setError("");
    setBackupStatus("");
    setIsBackingUp(true);

    try {
      const response = await fetch("/api/backups");

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Could not create backup.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getBackupFileName(response);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setBackupStatus(t("backupCreated"));
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "Could not create backup.");
    } finally {
      setIsBackingUp(false);
    }
  }

  return (
    <AppShell title={t("backup")} eyebrow="Admin">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <DatabaseBackup size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{t("backupDatabase")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Downloads a complete PostgreSQL dump — every table, every column. Keep it
                somewhere off this machine.
              </p>
            </div>
          </div>

          <div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBackingUp}
              onClick={() => void downloadBackup()}
              type="button"
            >
              <DatabaseBackup size={16} />
              {isBackingUp ? t("loading") : t("downloadBackup")}
            </button>
          </div>

          {backupStatus ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {backupStatus}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Terminal size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{t("restoreDatabase")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Restoring runs from a shell on the server, not from this page. It replaces the
                entire database, so it has to happen with the app stopped.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-950 p-4">
            <pre className="text-xs leading-6 text-slate-100">
              <code>{restoreCommands}</code>
            </pre>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            Use the password from <code className="rounded bg-slate-100 px-1">DATABASE_URL</code> in{" "}
            <code className="rounded bg-slate-100 px-1">.env</code>, and drop the{" "}
            <code className="rounded bg-slate-100 px-1">?schema=public</code> suffix —{" "}
            <code className="rounded bg-slate-100 px-1">pg_restore</code> rejects it.
          </p>
        </section>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </AppShell>
  );
}

function getBackupFileName(response: Response) {
  const header = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(header);

  return match?.[1] ?? `attendance-tracker-${new Date().toISOString().slice(0, 10)}.dump`;
}
