"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, subMonths } from "date-fns";
import { ArrowLeft, Fuel, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

type FuelTx = {
  id: string;
  transactionTime: string;
  productName: string | null;
  productQuantity: number | null;
  productMeasure: string | null;
  amount: number;
  stationName: string | null;
  cardNumber: string | null;
  plate: string;
};

type Totals = { amount: number; quantity: number };

export default function ExternalVehicleFuelPage() {
  const { t } = useLanguage();
  const params = useParams();
  const plate = decodeURIComponent(params.plate as string);

  const [from, setFrom] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [transactions, setTransactions] = useState<FuelTx[]>([]);
  const [totals, setTotals] = useState<Totals>({ amount: 0, quantity: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cardOwners, setCardOwners] = useState<Record<string, string>>({});

  useEffect(() => { void loadFuel(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFuel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/azpetrol/external-vehicles/${encodeURIComponent(plate)}?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTransactions(json.transactions);
      setTotals(json.totals);
      setCardOwners(json.cardOwners ?? {});
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const byProduct = transactions.reduce<Record<string, { quantity: number; amount: number; measure: string }>>((acc, tx) => {
    const key = tx.productName ?? "—";
    acc[key] = acc[key] ?? { quantity: 0, amount: 0, measure: tx.productMeasure ?? "" };
    acc[key].quantity += tx.productQuantity ?? 0;
    acc[key].amount += tx.amount;
    return acc;
  }, {});

  return (
    <AppShell title={`${t("fuelHistory")} · ${plate}`} eyebrow={t("attendanceTracker")}>
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
        <button onClick={() => void loadFuel()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Fuel size={15} />}
          {t("loadData")}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}

      {transactions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{t("totalCost")}</p>
            <p className="text-lg font-semibold text-slate-900">{totals.amount.toFixed(2)} AZN</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{t("totalQuantity")}</p>
            <p className="text-lg font-semibold text-slate-900">{totals.quantity.toFixed(2)} L</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{t("fillUps")}</p>
            <p className="text-lg font-semibold text-slate-900">{transactions.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">{t("avgCostPerFill")}</p>
            <p className="text-lg font-semibold text-slate-900">
              {(totals.amount / transactions.length).toFixed(2)} AZN
            </p>
          </div>
        </div>
      )}

      {Object.keys(byProduct).length > 1 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t("byProduct")}</p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(byProduct).map(([product, data]) => (
              <div key={product} className="text-sm">
                <span className="font-medium text-slate-800">{product}</span>
                <span className="text-slate-500 ml-2">{data.quantity.toFixed(2)} {data.measure} · {data.amount.toFixed(2)} AZN</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transactions.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">{transactions.length} {t("fuelTransactions")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap">{t("date")}</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">{t("fuelProduct")}</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">{t("fuelQty")}</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">{t("fuelCost")}</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">{t("fuelStation")}</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">{t("cardNumber")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {format(new Date(tx.transactionTime), "dd.MM.yyyy HH:mm")}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{tx.productName ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {tx.productQuantity != null ? `${tx.productQuantity} ${tx.productMeasure ?? ""}`.trim() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{tx.amount.toFixed(2)} AZN</td>
                    <td className="px-3 py-2 whitespace-nowrap">{tx.stationName ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                      {tx.cardNumber ? (
                        <>
                          <span className={cardOwners[tx.cardNumber] ? "text-slate-700 font-medium" : "text-slate-400"}>
                            {tx.cardNumber}
                          </span>
                          {cardOwners[tx.cardNumber] && (
                            <span className="ml-1 text-slate-400">({cardOwners[tx.cardNumber]})</span>
                          )}
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="bg-white border border-slate-200 rounded-lg py-12 text-center text-slate-400 text-sm">
            {t("noFuelTransactions")}
          </div>
        )
      )}
    </AppShell>
  );
}
