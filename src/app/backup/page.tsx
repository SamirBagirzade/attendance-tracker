"use client";

import { ChangeEvent, useState } from "react";
import { DatabaseBackup, RotateCcw, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

type RestoreCounts = Record<string, number>;

export default function BackupPage() {
  const { t } = useLanguage();
  const [backupStatus, setBackupStatus] = useState("");
  const [restoreStatus, setRestoreStatus] = useState("");
  const [error, setError] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState("");
  const [restoreCounts, setRestoreCounts] = useState<RestoreCounts | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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

  async function restoreBackup() {
    if (!backupFile) {
      setError("Select a backup file first.");
      return;
    }

    setError("");
    setRestoreStatus("");
    setRestoreCounts(null);
    setIsRestoring(true);

    try {
      const backup = JSON.parse(await backupFile.text());
      const response = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmRestore, backup }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Could not restore backup.");
      }

      setRestoreStatus(t("backupRestored"));
      setRestoreCounts(body.counts ?? null);
      setConfirmRestore("");
      setBackupFile(null);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Could not restore backup.");
    } finally {
      setIsRestoring(false);
    }
  }

  function updateBackupFile(event: ChangeEvent<HTMLInputElement>) {
    setBackupFile(event.target.files?.[0] ?? null);
    setRestoreStatus("");
    setRestoreCounts(null);
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
                {t("backupDatabaseDescription")}
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

        <section className="grid gap-4 rounded-lg border border-red-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-700">
              <RotateCcw size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{t("restoreDatabase")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {t("restoreDatabaseDescription")}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {t("restoreWarning")}
          </div>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("backupFile")}
            <input
              accept="application/json,.json"
              className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              onChange={updateBackupFile}
              type="file"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("confirmRestore")}
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setConfirmRestore(event.target.value)}
              placeholder="RESTORE"
              value={confirmRestore}
            />
            <span className="text-xs font-normal text-slate-500">{t("confirmRestoreHelp")}</span>
          </label>

          <div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!backupFile || confirmRestore !== "RESTORE" || isRestoring}
              onClick={() => void restoreBackup()}
              type="button"
            >
              <Upload size={16} />
              {isRestoring ? t("loading") : t("restoreBackup")}
            </button>
          </div>

          {restoreStatus ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {restoreStatus}
            </div>
          ) : null}

          {restoreCounts ? (
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {Object.entries(restoreCounts).map(([key, value]) => (
                <div className="rounded-md border border-slate-200 px-3 py-2" key={key}>
                  <dt className="truncate text-xs font-medium text-slate-500">{key}</dt>
                  <dd className="mt-1 text-base font-semibold text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
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

  return match?.[1] ?? `attendance-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
}
