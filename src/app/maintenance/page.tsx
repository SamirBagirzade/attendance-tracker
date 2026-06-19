"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import type { Car, CarMaintenanceRecord, CarMaintenanceType } from "@/types/domain";

const TYPE_COLORS: Record<CarMaintenanceType, string> = {
  OIL_CHANGE: "bg-amber-100 text-amber-800 border-amber-300",
  INSURANCE: "bg-blue-100 text-blue-800 border-blue-300",
  INSPECTION: "bg-violet-100 text-violet-800 border-violet-300",
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export default function MaintenancePage() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<CarMaintenanceRecord[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [filterCarId, setFilterCarId] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    if (filterCarId) params.set("carId", filterCarId);
    if (filterType) params.set("type", filterType);
    const response = await fetch(`/api/maintenance-records?${params}`);
    if (!response.ok) {
      setError("Could not load records.");
      return;
    }
    setRecords(await response.json());
  }, [filterCarId, filterType]);

  const loadCars = useCallback(async () => {
    const response = await fetch("/api/cars");
    if (response.ok) setCars(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCars();
  }, [loadCars]);

  async function deleteRecord(id: number) {
    setError("");
    const response = await fetch(`/api/maintenance-records/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete record.");
      return;
    }
    setRecords((current) => current.filter((r) => r.id !== id));
  }

  function typeLabel(type: CarMaintenanceType): string {
    if (type === "OIL_CHANGE") return t("typeOilChange");
    if (type === "INSURANCE") return t("typeInsurance");
    return t("typeInspection");
  }

  function recordDetails(record: CarMaintenanceRecord): string {
    const parts: string[] = [];
    if (record.km != null) parts.push(`${record.km.toLocaleString()} km`);
    if (record.oilBrand) parts.push(record.oilBrand);
    if (record.oilQuantity != null) parts.push(`${record.oilQuantity} L`);
    if (record.company) parts.push(record.company);
    if (record.cost != null) parts.push(`${record.cost.toLocaleString()} ₼`);
    if (record.notes) parts.push(record.notes);
    return parts.join(" · ");
  }

  return (
    <AppShell title={t("maintenanceHistory")} eyebrow={t("fleet")}>
      <div className="grid gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("cars")}
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              value={filterCarId}
              onChange={(e) => setFilterCarId(e.target.value)}
            >
              <option value="">{t("allCars")}</option>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.makeModel} ({car.licensePlate})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("type")}
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">{t("allTypes")}</option>
              <option value="OIL_CHANGE">{t("typeOilChange")}</option>
              <option value="INSURANCE">{t("typeInsurance")}</option>
              <option value="INSPECTION">{t("typeInspection")}</option>
            </select>
          </label>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("date")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("cars")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("type")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("description")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      {t("noMaintenanceRecords")}
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr className="border-b border-slate-100" key={record.id}>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{record.car.makeModel}</div>
                        <div className="text-xs text-slate-500 uppercase">{record.car.licensePlate}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[record.type]}`}>
                          {typeLabel(record.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {recordDetails(record) || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                          onClick={() => void deleteRecord(record.id)}
                          type="button"
                        >
                          <Trash2 size={14} />
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
