"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subMonths, startOfYear } from "date-fns";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Fuel, Loader2, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];
const BAR_BLUE = "#3b82f6";
const BAR_AMBER = "#f59e0b";

type Summary = { totalAmount: number; totalQuantity: number; totalFillUps: number; avgCostPerFill: number; avgQtyPerFill: number; uniquePlates: number; uniqueStations: number };
type MonthRow = { month: string; amount: number; quantity: number; fillUps: number };
type ProductRow = { product: string; amount: number; quantity: number; fillUps: number };
type CarRow = { plate: string; carName: string | null; isExternal: boolean; amount: number; quantity: number; fillUps: number };
type StationRow = { station: string; amount: number; quantity: number; fillUps: number };
type CardNumberRow = { cardNumber: string; licensePlate: string | null; amount: number; quantity: number; fillUps: number };
type ReportData = {
  summary: Summary;
  byMonth: MonthRow[];
  byProduct: ProductRow[];
  byCar: CarRow[];
  byStation: StationRow[];
  byCardNumber: CardNumberRow[];
};

const PRESETS = [
  { labelKey: "last30", months: 1 },
  { labelKey: "last90", months: 3 },
  { labelKey: "last180", months: 6 },
  { labelKey: "ytd", months: 0 },
];

const TOOLTIP_STYLE = { border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 };

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-slate-700 mb-3">{children}</h2>;
}

export default function FuelReportPage() {
  const { t } = useLanguage();

  const [from, setFrom] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [carFilter, setCarFilter] = useState<"all" | "company" | "external">("all");
  const [sortCol, setSortCol] = useState<"amount" | "quantity" | "fillUps">("amount");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/fuel-report?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  function applyPreset(months: number) {
    const today = new Date();
    if (months === 0) {
      setFrom(format(startOfYear(today), "yyyy-MM-dd"));
    } else {
      setFrom(format(subMonths(today, months), "yyyy-MM-dd"));
    }
    setTo(format(today, "yyyy-MM-dd"));
  }

  const filteredCars = useMemo(() => {
    if (!data) return [];
    return data.byCar
      .filter((c) => carFilter === "all" || (carFilter === "company" ? !c.isExternal : c.isExternal))
      .sort((a, b) => b[sortCol] - a[sortCol]);
  }, [data, carFilter, sortCol]);

  const top10Cars = useMemo(() => (data?.byCar ?? []).slice(0, 10).map((c) => ({
    name: c.carName ? c.carName.split(" (")[0] : c.plate,
    amount: c.amount,
    quantity: c.quantity,
  })), [data]);

  const top10Stations = useMemo(() => (data?.byStation ?? []).slice(0, 10).map((s) => ({
    name: s.station,
    amount: s.amount,
    fillUps: s.fillUps,
  })), [data]);

  async function exportExcel() {
    if (!data) return;
    const xlsx = await import("xlsx");

    const wb = xlsx.utils.book_new();

    // Summary sheet
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
      ["Fuel Report", `${from} → ${to}`],
      [],
      [t("totalCost"), data.summary.totalAmount + " AZN"],
      [t("totalQuantity"), data.summary.totalQuantity + " L"],
      [t("fillUps"), data.summary.totalFillUps],
      [t("avgPerFill"), data.summary.avgCostPerFill + " AZN"],
      [t("avgQtyPerFill"), data.summary.avgQtyPerFill + " L"],
      [t("uniquePlates"), data.summary.uniquePlates],
      [t("uniqueStations"), data.summary.uniqueStations],
    ]), "Summary");

    // Monthly
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data.byMonth.map((r) => ({
      Month: r.month, "Cost (AZN)": r.amount, "Qty (L)": r.quantity, "Fill-ups": r.fillUps,
    }))), t("monthlyTrend"));

    // By car
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data.byCar.map((r) => ({
      Plate: r.plate, Car: r.carName ?? "—", Type: r.isExternal ? t("externalLabel") : t("companyLabel"),
      "Cost (AZN)": r.amount, "Qty (L)": r.quantity, "Fill-ups": r.fillUps,
    }))), t("byCar"));

    // By station
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data.byStation.map((r) => ({
      Station: r.station, "Cost (AZN)": r.amount, "Qty (L)": r.quantity, "Fill-ups": r.fillUps,
    }))), t("byStation"));

    // By product
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data.byProduct.map((r) => ({
      Product: r.product, "Cost (AZN)": r.amount, "Qty (L)": r.quantity, "Fill-ups": r.fillUps,
    }))), t("byProduct"));

    // By card number
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data.byCardNumber.map((r) => ({
      "Card No.": r.cardNumber, "License Plate": r.licensePlate ?? "", "Cost (AZN)": r.amount, "Qty (L)": r.quantity, "Fill-ups": r.fillUps,
    }))), t("byCardNumber"));

    xlsx.writeFile(wb, `fuel-report-${from}-${to}.xlsx`);
  }

  return (
    <AppShell title={t("fuelReport")} eyebrow={t("attendanceTracker")}>
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end">
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
        <div className="flex gap-1.5">
          {[
            { label: "1M", months: 1 }, { label: "3M", months: 3 },
            { label: "6M", months: 6 }, { label: "YTD", months: 0 },
          ].map(({ label, months }) => (
            <button key={label} onClick={() => applyPreset(months)}
              className="h-9 px-3 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => void loadReport()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Fuel size={15} />}
          {t("loadData")}
        </button>
        <button onClick={() => void exportExcel()} disabled={!data}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 transition ml-auto">
          <Download size={15} />
          {t("exportExcel")}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>}

      {data && (<>
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <KpiCard label={t("totalCost")} value={`${data.summary.totalAmount.toFixed(2)} AZN`} />
          <KpiCard label={t("totalQuantity")} value={`${data.summary.totalQuantity.toFixed(2)} L`} />
          <KpiCard label={t("fillUps")} value={String(data.summary.totalFillUps)} />
          <KpiCard label={t("avgPerFill")} value={`${data.summary.avgCostPerFill.toFixed(2)} AZN`} />
          <KpiCard label={t("avgQtyPerFill")} value={`${data.summary.avgQtyPerFill.toFixed(2)} L`} />
          <KpiCard label={t("uniqueStations")} value={String(data.summary.uniqueStations)} />
        </div>

        {/* Row 1: Monthly trend + Product pie */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-blue-500" />
              <SectionTitle>{t("monthlyTrend")}</SectionTitle>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byMonth} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#94a3b8" }} width={55}
                  tickFormatter={(v) => `₼${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} width={45}
                  tickFormatter={(v) => `${v}L`} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v, n) => [n === "amount" ? `${Number(v).toFixed(2)} AZN` : `${Number(v).toFixed(2)} L`, n === "amount" ? t("fuelCost") : t("fuelQty")]} />
                <Legend formatter={(v) => v === "amount" ? t("fuelCost") : t("fuelQty")} />
                <Bar yAxisId="left" dataKey="amount" fill={BAR_BLUE} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="quantity" fill={BAR_AMBER} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <SectionTitle>{t("byProduct")}</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.byProduct} dataKey="amount" nameKey="product" cx="50%" cy="50%"
                  outerRadius={70} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10}>
                  {data.byProduct.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [`${Number(v).toFixed(2)} AZN`, t("fuelCost")]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {data.byProduct.map((p, i) => (
                <div key={p.product} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-700">{p.product}</span>
                  </div>
                  <span className="text-slate-500 font-medium">{p.amount.toFixed(2)} AZN</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Top cars + Top stations */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <SectionTitle>{t("topCars")}</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(200, top10Cars.length * 32)}>
              <BarChart data={top10Cars} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `₼${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={100} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [`${Number(v).toFixed(2)} AZN`, t("fuelCost")]} />
                <Bar dataKey="amount" fill={BAR_BLUE} radius={[0, 4, 4, 0]} maxBarSize={20}
                  label={{ position: "right", fontSize: 10, fill: "#64748b", formatter: (v: unknown) => `₼${Number(v).toFixed(0)}` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <SectionTitle>{t("topStations")}</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(200, top10Stations.length * 32)}>
              <BarChart data={top10Stations} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `₼${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} width={100} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [`${Number(v).toFixed(2)} AZN`, t("fuelCost")]} />
                <Bar dataKey="amount" fill={BAR_AMBER} radius={[0, 4, 4, 0]} maxBarSize={20}
                  label={{ position: "right", fontSize: 10, fill: "#64748b", formatter: (v: unknown) => `₼${Number(v).toFixed(0)}` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By card number table */}
        {data && data.byCardNumber.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
            <div className="px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">{t("byCardNumber")}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">{t("cardNumber")}</th>
                    <th className="px-4 py-2 text-left">{t("licensePlate")}</th>
                    <th className="px-4 py-2 text-right">{t("fuelCost")}</th>
                    <th className="px-4 py-2 text-right">{t("fuelQty")}</th>
                    <th className="px-4 py-2 text-right">{t("fillUps")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byCardNumber.map((row) => (
                    <tr key={row.cardNumber} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs">{row.cardNumber}</td>
                      <td className="px-4 py-2">
                        {row.licensePlate
                          ? <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">{row.licensePlate}</span>
                          : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{row.amount.toFixed(2)} AZN</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.quantity.toFixed(1)} L</td>
                      <td className="px-4 py-2 text-right text-slate-500">{row.fillUps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{t("byCar")} — {filteredCars.length}</span>
            <div className="flex gap-2 items-center flex-wrap">
              {(["all", "company", "external"] as const).map((f) => (
                <button key={f} onClick={() => setCarFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${carFilter === f ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {f === "all" ? "All" : f === "company" ? t("companyLabel") : t("externalLabel")}
                </button>
              ))}
              <select value={sortCol} onChange={(e) => setSortCol(e.target.value as typeof sortCol)}
                className="text-xs rounded-md border border-slate-200 px-2 py-1 focus:outline-none">
                <option value="amount">{t("fuelCost")}</option>
                <option value="quantity">{t("fuelQty")}</option>
                <option value="fillUps">{t("fillUps")}</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">{t("licensePlate")}</th>
                  <th className="px-4 py-2.5 text-left">{t("makeModel")}</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-right">{t("fillUps")}</th>
                  <th className="px-4 py-2.5 text-right">{t("totalQuantity")}</th>
                  <th className="px-4 py-2.5 text-right">{t("totalCost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCars.map((c) => (
                  <tr key={c.plate} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-800">{c.plate}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.carName?.split(" (")[0] ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.isExternal ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                        {c.isExternal ? t("externalLabel") : t("companyLabel")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{c.fillUps}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{c.quantity.toFixed(2)} L</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{c.amount.toFixed(2)} AZN</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 text-sm font-semibold border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-slate-600">Total</td>
                  <td className="px-4 py-2.5 text-right">{filteredCars.reduce((s, c) => s + c.fillUps, 0)}</td>
                  <td className="px-4 py-2.5 text-right">{filteredCars.reduce((s, c) => s + c.quantity, 0).toFixed(2)} L</td>
                  <td className="px-4 py-2.5 text-right text-slate-900">{filteredCars.reduce((s, c) => s + c.amount, 0).toFixed(2)} AZN</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </>)}

      {!loading && !data && !error && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400 text-sm">{t("noData")}</div>
      )}
    </AppShell>
  );
}
