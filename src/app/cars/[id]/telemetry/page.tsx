"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { ArrowLeft, MapPin, Navigation, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

type ReportRow = Record<string, string | number | null>;

type CurrentPosition = { lat: number; lon: number; speedKmh: number; course: number; timestampUtc: string } | null;

type TelemetryReport = {
  unitId: number;
  unitName: string;
  currentPosition: CurrentPosition;
  stats: Array<{ label: string; value: string }>;
  fillings: ReportRow[];
  leaks: ReportRow[];
  trips: ReportRow[];
};

const TRIP_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "time_begin", label: "Start" },
  { key: "location_begin", label: "From" },
  { key: "time_end", label: "End" },
  { key: "location_end", label: "To" },
  { key: "driver", label: "Driver" },
  { key: "duration", label: "Duration" },
  { key: "mileage", label: "Mileage" },
  { key: "max_speed", label: "Max Speed" },
  { key: "fuel_consumption_fls", label: "Fuel Used" },
  { key: "avg_fuel_consumption_fls", label: "Avg L/100km" },
];

const FILLING_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "time_end", label: "Time" },
  { key: "location_end", label: "Location" },
  { key: "fuel_level_begin", label: "Fuel Before" },
  { key: "fuel_level_filled", label: "Fuel After" },
  { key: "filled", label: "Filled" },
];

const LEAK_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "time_begin", label: "Start" },
  { key: "location_begin", label: "Location" },
  { key: "time_end", label: "End" },
  { key: "fuel_level_begin", label: "Fuel Before" },
  { key: "fuel_level_thefted", label: "Fuel After" },
  { key: "thefted", label: "Leaked" },
];

function mapLink(row: ReportRow, key: string): string | null {
  const lat = row[`${key}_lat`];
  const lon = row[`${key}_lon`];
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function GenericTable({ rows, columns }: { rows: ReportRow[]; columns: Array<{ key: string; label: string }> }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 transition">
              {columns.map((c) => {
                const link = mapLink(row, c.key);
                return (
                  <td key={c.key} className="px-3 py-2 whitespace-nowrap text-slate-700">
                    {row[c.key] ?? "—"}
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex text-slate-400 hover:text-slate-700">
                        <MapPin size={12} />
                      </a>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CarTelemetryPage() {
  const { t } = useLanguage();
  const params = useParams();
  const carId = params.id as string;

  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [report, setReport] = useState<TelemetryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [carLabel, setCarLabel] = useState("");

  useEffect(() => {
    fetch(`/api/cars/${carId}`)
      .then((r) => r.json())
      .then((data) => { if (data.makeModel) setCarLabel(`${data.makeModel} · ${data.licensePlate}`); })
      .catch(() => {});
  }, [carId]);

  useEffect(() => {
    void loadTelemetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTelemetry() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/cars/${carId}/telemetry?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setReport(json);
    } catch (err) {
      setError(String(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title={carLabel ? `${t("telemetry")} · ${carLabel}` : t("telemetry")} eyebrow={t("attendanceTracker")}>
      <div className="mb-4">
        <Link href="/cars" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
          <ArrowLeft size={14} /> {t("backToCars")}
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t("from")}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t("to")}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <button onClick={() => void loadTelemetry()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
          {t("loadData")}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {report && (
        <>
          {report.currentPosition && (
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-slate-700">
                <span className="font-medium">{t("currentPosition")}:</span>{" "}
                {report.currentPosition.lat.toFixed(5)}, {report.currentPosition.lon.toFixed(5)}
                <span className="text-slate-400 ml-2">
                  {report.currentPosition.speedKmh} km/h · {format(new Date(report.currentPosition.timestampUtc), "dd.MM.yyyy HH:mm")}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps?q=${report.currentPosition.lat},${report.currentPosition.lon}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                <MapPin size={14} /> {t("viewOnMap")}
              </a>
            </div>
          )}

          {report.stats.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {report.stats.map((s, i) => (
                  <div key={i} className="text-sm">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="font-medium text-slate-800">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.fillings.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">{t("fillUps")} ({report.fillings.length})</span>
              </div>
              <GenericTable rows={report.fillings} columns={FILLING_COLUMNS} />
            </div>
          )}

          {report.leaks.length > 0 && (
            <div className="bg-white border border-rose-200 rounded-lg overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-rose-100 bg-rose-50">
                <span className="text-sm font-medium text-rose-700">{t("fuelLeaks")} ({report.leaks.length})</span>
              </div>
              <GenericTable rows={report.leaks} columns={LEAK_COLUMNS} />
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700">{t("trips")} ({report.trips.length})</span>
            </div>
            {report.trips.length > 0 ? (
              <GenericTable rows={report.trips} columns={TRIP_COLUMNS} />
            ) : (
              !loading && <div className="py-12 text-center text-slate-400 text-sm">{t("noTelemetryData")}</div>
            )}
          </div>
        </>
      )}

      {!report && !loading && !error && (
        <div className="bg-white border border-slate-200 rounded-lg py-12 text-center text-slate-400 text-sm">
          {t("noTelemetryData")}
        </div>
      )}
    </AppShell>
  );
}
