"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";
import type { Car } from "@/types/domain";

type MaintenanceDraft = {
  currentKm: string;
  oilChangeDate: string;
  oilChangeKm: string;
  oilBrand: string;
  oilQuantity: string;
  oilChangeIntervalKm: string;
  insuranceDate: string;
  insuranceCompany: string;
  insuranceCost: string;
  insuranceIntervalMonths: string;
  inspectionDate: string;
  inspectionIntervalMonths: string;
};

function carToMaintenanceDraft(car: Car): MaintenanceDraft {
  return {
    currentKm: car.currentKm?.toString() ?? "",
    oilChangeDate: car.oilChangeDate ?? "",
    oilChangeKm: car.oilChangeKm?.toString() ?? "",
    oilBrand: car.oilBrand ?? "",
    oilQuantity: car.oilQuantity?.toString() ?? "",
    oilChangeIntervalKm: car.oilChangeIntervalKm?.toString() ?? "",
    insuranceDate: car.insuranceDate ?? "",
    insuranceCompany: car.insuranceCompany ?? "",
    insuranceCost: car.insuranceCost?.toString() ?? "",
    insuranceIntervalMonths: car.insuranceIntervalMonths?.toString() ?? "12",
    inspectionDate: car.inspectionDate ?? "",
    inspectionIntervalMonths: car.inspectionIntervalMonths?.toString() ?? "12",
  };
}

export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1 + months, d));
  return result.toISOString().slice(0, 10);
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

type DateStatus = "ok" | "warning" | "overdue" | "none";

function getDateStatus(dateStr: string | null): DateStatus {
  if (!dateStr) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(dateStr);
  const diffDays = Math.floor((next.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "warning";
  return "ok";
}

function getKmStatus(nextKm: number | null, currentKm: number | null): DateStatus {
  if (nextKm === null) return "none";
  if (currentKm === null) return "ok";
  if (currentKm >= nextKm) return "overdue";
  if (nextKm - currentKm <= 1000) return "warning";
  return "ok";
}

const statusClasses: Record<DateStatus, string> = {
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  warning: "text-amber-700 bg-amber-50 border-amber-200",
  overdue: "text-red-700 bg-red-50 border-red-200",
  none: "text-slate-400",
};

function StatusBadge({ status, children }: { status: DateStatus; children: React.ReactNode }) {
  if (status === "none") return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${statusClasses[status]}`}>
      {children}
    </span>
  );
}

function computeNextOilKm(car: Car): number | null {
  if (car.oilChangeKm == null || car.oilChangeIntervalKm == null) return null;
  return car.oilChangeKm + car.oilChangeIntervalKm;
}

function computeNextDate(dateStr: string | null, months: number | null): string | null {
  if (!dateStr || months == null) return null;
  return addMonths(dateStr, months);
}

export default function CarsPage() {
  const { t } = useLanguage();
  const [cars, setCars] = useState<Car[]>([]);
  const [form, setForm] = useState({ makeModel: "", licensePlate: "" });
  const [error, setError] = useState("");
  const [savedCarId, setSavedCarId] = useState<number | null>(null);
  const [expandedCarId, setExpandedCarId] = useState<number | null>(null);
  const [maintenanceDrafts, setMaintenanceDrafts] = useState<Record<number, MaintenanceDraft>>({});
  const [savedMaintenanceCarId, setSavedMaintenanceCarId] = useState<number | null>(null);

  const loadCars = useCallback(async () => {
    setError("");
    const response = await fetch("/api/cars");
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not load cars.");
      return;
    }
    setCars(await response.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCars();
  }, [loadCars]);

  async function createCar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavedCarId(null);
    const response = await fetch("/api/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not add car.");
      return;
    }
    setForm({ makeModel: "", licensePlate: "" });
    await loadCars();
  }

  async function updateCar(car: Car) {
    setError("");
    setSavedCarId(null);
    const response = await fetch(`/api/cars/${car.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(car),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not update car.");
      await loadCars();
      return;
    }
    const updated: Car = await response.json();
    setCars((current) => current.map((item) => (item.id === car.id ? updated : item)));
    setSavedCarId(car.id);
  }

  async function saveMaintenance(car: Car) {
    const draft = maintenanceDrafts[car.id];
    if (!draft) return;

    setError("");
    setSavedMaintenanceCarId(null);

    const payload = {
      makeModel: car.makeModel,
      licensePlate: car.licensePlate,
      currentKm: draft.currentKm || null,
      oilChangeDate: draft.oilChangeDate || null,
      oilChangeKm: draft.oilChangeKm || null,
      oilBrand: draft.oilBrand || null,
      oilQuantity: draft.oilQuantity || null,
      oilChangeIntervalKm: draft.oilChangeIntervalKm || null,
      insuranceDate: draft.insuranceDate || null,
      insuranceCompany: draft.insuranceCompany || null,
      insuranceCost: draft.insuranceCost || null,
      insuranceIntervalMonths: draft.insuranceIntervalMonths || null,
      inspectionDate: draft.inspectionDate || null,
      inspectionIntervalMonths: draft.inspectionIntervalMonths || null,
    };

    const response = await fetch(`/api/cars/${car.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not save maintenance data.");
      return;
    }

    const updated: Car = await response.json();
    setCars((current) => current.map((item) => (item.id === car.id ? updated : item)));

    // Auto-log history records for each section that has a date
    const historyEntries: object[] = [];
    if (draft.oilChangeDate) {
      historyEntries.push({
        carId: car.id, type: "OIL_CHANGE", date: draft.oilChangeDate,
        km: draft.oilChangeKm || null, oilBrand: draft.oilBrand || null,
        oilQuantity: draft.oilQuantity || null,
      });
    }
    if (draft.insuranceDate) {
      historyEntries.push({
        carId: car.id, type: "INSURANCE", date: draft.insuranceDate,
        company: draft.insuranceCompany || null, cost: draft.insuranceCost || null,
      });
    }
    if (draft.inspectionDate) {
      historyEntries.push({
        carId: car.id, type: "INSPECTION", date: draft.inspectionDate,
      });
    }
    await Promise.all(
      historyEntries.map((entry) =>
        fetch("/api/maintenance-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        }),
      ),
    );

    setSavedMaintenanceCarId(car.id);
  }

  async function deleteCar(id: number) {
    setError("");
    setSavedCarId(null);
    const response = await fetch(`/api/cars/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not delete car.");
      return;
    }
    setCars((current) => current.filter((car) => car.id !== id));
    if (expandedCarId === id) setExpandedCarId(null);
  }

  function toggleExpand(car: Car) {
    if (expandedCarId === car.id) {
      setExpandedCarId(null);
    } else {
      setExpandedCarId(car.id);
      setSavedMaintenanceCarId(null);
      setMaintenanceDrafts((prev) => ({
        ...prev,
        [car.id]: carToMaintenanceDraft(car),
      }));
    }
  }

  function updateDraft(carId: number, field: keyof MaintenanceDraft, value: string) {
    setMaintenanceDrafts((prev) => ({
      ...prev,
      [carId]: { ...prev[carId], [field]: value },
    }));
  }

  return (
    <AppShell title={t("cars")} eyebrow={t("fleet")}>
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_auto]"
          onSubmit={createCar}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("makeModel")}
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
              onChange={(e) => setForm((c) => ({ ...c, makeModel: e.target.value }))}
              placeholder="Toyota Prado"
              value={form.makeModel}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("licensePlate")}
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm uppercase outline-none focus:border-slate-500"
              onChange={(e) => setForm((c) => ({ ...c, licensePlate: e.target.value }))}
              placeholder="10-AA-100"
              value={form.licensePlate}
            />
          </label>
          <div className="flex items-end">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              type="submit"
            >
              <Plus size={16} />
              {t("add")}
            </button>
          </div>
        </form>

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
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("makeModel")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("licensePlate")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{t("nextOil")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{t("nextInsurance")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{t("nextInspection")}</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {cars.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      {t("noCars")}
                    </td>
                  </tr>
                ) : (
                  cars.map((car) => {
                    const draft = maintenanceDrafts[car.id];
                    const isExpanded = expandedCarId === car.id;

                    // Computed values from saved car data (for columns)
                    const nextOilKm = computeNextOilKm(car);
                    const nextInsuranceDate = computeNextDate(car.insuranceDate, car.insuranceIntervalMonths);
                    const nextInspectionDate = computeNextDate(car.inspectionDate, car.inspectionIntervalMonths);

                    const oilStatus = getKmStatus(nextOilKm, car.currentKm);
                    const insStatus = getDateStatus(nextInsuranceDate);
                    const inspStatus = getDateStatus(nextInspectionDate);

                    // Computed from draft (for expanded panel)
                    const draftNextOilKm =
                      draft && draft.oilChangeKm !== "" && draft.oilChangeIntervalKm !== ""
                        ? Number(draft.oilChangeKm) + Number(draft.oilChangeIntervalKm)
                        : null;
                    const currentKmNum =
                      draft && draft.currentKm !== "" ? Number(draft.currentKm) : null;
                    const oilExceeded =
                      draftNextOilKm !== null && currentKmNum !== null && currentKmNum > draftNextOilKm
                        ? currentKmNum - draftNextOilKm
                        : null;
                    const oilRemaining =
                      draftNextOilKm !== null && currentKmNum !== null && currentKmNum <= draftNextOilKm
                        ? draftNextOilKm - currentKmNum
                        : null;

                    const draftNextInsuranceDate =
                      draft && draft.insuranceDate !== "" && draft.insuranceIntervalMonths !== ""
                        ? addMonths(draft.insuranceDate, Number(draft.insuranceIntervalMonths))
                        : null;
                    const draftNextInspectionDate =
                      draft && draft.inspectionDate !== "" && draft.inspectionIntervalMonths !== ""
                        ? addMonths(draft.inspectionDate, Number(draft.inspectionIntervalMonths))
                        : null;

                    return (
                      <>
                        <tr className="border-b border-slate-100" key={car.id}>
                          <td className="px-4 py-3">
                            <input
                              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                              onBlur={() => void updateCar(car)}
                              onChange={(e) =>
                                setCars((curr) =>
                                  curr.map((item) =>
                                    item.id === car.id ? { ...item, makeModel: e.target.value } : item,
                                  ),
                                )
                              }
                              value={car.makeModel}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm uppercase outline-none focus:border-slate-500"
                              onBlur={() => void updateCar(car)}
                              onChange={(e) =>
                                setCars((curr) =>
                                  curr.map((item) =>
                                    item.id === car.id ? { ...item, licensePlate: e.target.value } : item,
                                  ),
                                )
                              }
                              value={car.licensePlate}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={oilStatus}>
                              {nextOilKm !== null ? `${nextOilKm.toLocaleString()} km` : ""}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={insStatus}>
                              {nextInsuranceDate ? formatDateDisplay(nextInsuranceDate) : ""}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={inspStatus}>
                              {nextInspectionDate ? formatDateDisplay(nextInspectionDate) : ""}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {savedCarId === car.id ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                  <Check size={14} />
                                  Saved
                                </span>
                              ) : null}
                              <button
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                                onClick={() => void deleteCar(car.id)}
                                type="button"
                              >
                                <Trash2 size={16} />
                                {t("delete")}
                              </button>
                              <button
                                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
                                  isExpanded
                                    ? "border-slate-400 bg-slate-100 text-slate-800"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                                onClick={() => toggleExpand(car)}
                                type="button"
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                {t("details")}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && draft ? (
                          <tr key={`${car.id}-details`} className="border-b border-slate-100 bg-slate-50">
                            <td colSpan={6} className="px-4 py-5">
                              <div className="grid gap-4 lg:grid-cols-3">
                                {/* Oil Change Panel */}
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                  <h3 className="mb-3 font-semibold text-amber-900">{t("oilChange")}</h3>
                                  <div className="grid gap-2">
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("lastOilChangeDate")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-500"
                                        type="date"
                                        value={draft.oilChangeDate}
                                        onChange={(e) => updateDraft(car.id, "oilChangeDate", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("lastOilChangeKm")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-500"
                                        type="number" min="0" placeholder="0"
                                        value={draft.oilChangeKm}
                                        onChange={(e) => updateDraft(car.id, "oilChangeKm", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("currentKm")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-500"
                                        type="number" min="0" placeholder="0"
                                        value={draft.currentKm}
                                        onChange={(e) => updateDraft(car.id, "currentKm", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("oilBrand")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-500"
                                        type="text" placeholder="Mobil 1"
                                        value={draft.oilBrand}
                                        onChange={(e) => updateDraft(car.id, "oilBrand", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("oilQuantityL")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-500"
                                        type="number" min="0" step="0.1" placeholder="4.5"
                                        value={draft.oilQuantity}
                                        onChange={(e) => updateDraft(car.id, "oilQuantity", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("oilChangeIntervalKm")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-500"
                                        type="number" min="0" placeholder="10000"
                                        value={draft.oilChangeIntervalKm}
                                        onChange={(e) => updateDraft(car.id, "oilChangeIntervalKm", e.target.value)}
                                      />
                                    </label>
                                  </div>
                                  {draftNextOilKm !== null && (
                                    <div className="mt-3 rounded-md border border-amber-300 bg-white p-3 text-xs space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">{t("nextOilChangeKm")}</span>
                                        <span className="font-semibold text-slate-800">{draftNextOilKm.toLocaleString()} km</span>
                                      </div>
                                      {oilExceeded !== null && (
                                        <div className="flex justify-between">
                                          <span className="text-red-600">{t("oilExceededBy")}</span>
                                          <span className="font-semibold text-red-700">+{oilExceeded.toLocaleString()} km</span>
                                        </div>
                                      )}
                                      {oilRemaining !== null && (
                                        <div className="flex justify-between">
                                          <span className="text-emerald-600">{t("oilRemainingKm")}</span>
                                          <span className="font-semibold text-emerald-700">{oilRemaining.toLocaleString()} km</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Insurance Panel */}
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                  <h3 className="mb-3 font-semibold text-blue-900">{t("insurance")}</h3>
                                  <div className="grid gap-2">
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("lastInsuranceDate")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                                        type="date"
                                        value={draft.insuranceDate}
                                        onChange={(e) => updateDraft(car.id, "insuranceDate", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("insuranceCompany")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                                        type="text" placeholder="Ateshgah"
                                        value={draft.insuranceCompany}
                                        onChange={(e) => updateDraft(car.id, "insuranceCompany", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("insuranceCost")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                                        type="number" min="0" step="0.01" placeholder="0.00"
                                        value={draft.insuranceCost}
                                        onChange={(e) => updateDraft(car.id, "insuranceCost", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("renewalIntervalMonths")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                                        type="number" min="1" placeholder="12"
                                        value={draft.insuranceIntervalMonths}
                                        onChange={(e) => updateDraft(car.id, "insuranceIntervalMonths", e.target.value)}
                                      />
                                    </label>
                                  </div>
                                  {draftNextInsuranceDate && (
                                    <div className="mt-3 rounded-md border border-blue-300 bg-white p-3 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">{t("nextRenewalDate")}</span>
                                        <span className="font-semibold text-slate-800">{formatDateDisplay(draftNextInsuranceDate)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Inspection Panel */}
                                <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                                  <h3 className="mb-3 font-semibold text-violet-900">{t("inspection")}</h3>
                                  <div className="grid gap-2">
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("lastInspectionDate")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-500"
                                        type="date"
                                        value={draft.inspectionDate}
                                        onChange={(e) => updateDraft(car.id, "inspectionDate", e.target.value)}
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-medium text-slate-600">
                                      {t("renewalIntervalMonths")}
                                      <input
                                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-500"
                                        type="number" min="1" placeholder="12"
                                        value={draft.inspectionIntervalMonths}
                                        onChange={(e) => updateDraft(car.id, "inspectionIntervalMonths", e.target.value)}
                                      />
                                    </label>
                                  </div>
                                  {draftNextInspectionDate && (
                                    <div className="mt-3 rounded-md border border-violet-300 bg-white p-3 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">{t("nextRenewalDate")}</span>
                                        <span className="font-semibold text-slate-800">{formatDateDisplay(draftNextInspectionDate)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 flex items-center gap-3">
                                <button
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
                                  onClick={() => void saveMaintenance(car)}
                                  type="button"
                                >
                                  <Check size={15} />
                                  {t("saveDetails")}
                                </button>
                                {savedMaintenanceCarId === car.id && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                    <Check size={13} />
                                    Saved
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
