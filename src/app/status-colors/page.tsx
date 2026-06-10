"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { AttendanceStatus, StatusColor } from "@/types/domain";

const statusLabels: Record<AttendanceStatus, string> = {
  ISDE: "Isde",
  EZAMIYYET: "Ezamiyyet",
  MEZUNIYYET: "Mezuniyyet",
  XESTE: "Xeste",
};

export default function StatusColorsPage() {
  const [colors, setColors] = useState<StatusColor[]>([]);
  const [error, setError] = useState("");
  const [savedStatus, setSavedStatus] = useState<AttendanceStatus | null>(null);

  const loadColors = useCallback(async () => {
    setError("");
    const response = await fetch("/api/status-colors");

    if (!response.ok) {
      setError("Could not load status colors.");
      return;
    }

    setColors(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadColors();
  }, [loadColors]);

  async function updateSetting(status: AttendanceStatus, next: Partial<StatusColor>) {
    setError("");
    setSavedStatus(null);
    const currentSetting = colors.find((item) => item.status === status);
    const updatedSetting = {
      status,
      color: next.color ?? currentSetting?.color ?? "#ffffff",
      displayText: next.displayText ?? currentSetting?.displayText ?? status.slice(0, 1),
    };

    setColors((current) =>
      current.map((item) => (item.status === status ? { ...item, ...next } : item)),
    );

    const response = await fetch("/api/status-colors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedSetting),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not update status color.");
      await loadColors();
      return;
    }

    setSavedStatus(status);
  }

  return (
    <AppShell title="Status Colors" eyebrow="Timesheet display">
      <div className="grid gap-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Cell Preview</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Cell Text</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Color</th>
              </tr>
            </thead>
            <tbody>
              {colors.map((item) => (
                <tr className="border-b border-slate-100" key={item.status}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-950">{statusLabels[item.status]}</div>
                    <div className="text-xs text-slate-500">{item.status}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="inline-flex h-12 w-14 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-slate-900"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.displayText}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="h-10 w-full max-w-64 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                      maxLength={24}
                      onBlur={(event) =>
                        void updateSetting(item.status, {
                          displayText: event.target.value,
                        })
                      }
                      onChange={(event) =>
                        setColors((current) =>
                          current.map((setting) =>
                            setting.status === item.status
                              ? { ...setting, displayText: event.target.value }
                              : setting,
                          ),
                        )
                      }
                      value={item.displayText}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        className="h-10 w-14 cursor-pointer rounded-md border border-slate-300 bg-white"
                        onChange={(event) =>
                          void updateSetting(item.status, { color: event.target.value })
                        }
                        title={`Color for ${item.status}`}
                        type="color"
                        value={item.color}
                      />
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {item.color}
                      </code>
                      {savedStatus === item.status ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <Check size={14} />
                          Saved
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
