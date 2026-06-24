"use client";

import { useState } from "react";
import { format, subDays, endOfMonth, startOfMonth, addMonths } from "date-fns";
import { Search, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

const TRANSACTION_TYPES: Record<string, string> = {
  "21": "Card Sale",
  "22": "Card Refund",
  "11": "Increase Customer Balance",
  "12": "Decrease Customer Balance",
  "27": "Coupon Sale",
  "28": "Coupon Refund",
  "13": "Increase Card Balance",
  "14": "Decrease Card Balance",
  "19": "Card Balance Transfer",
  "29": "Increase VAT Balance",
  "30": "Decrease VAT Balance",
};

type Transaction = Record<string, unknown>;

function txId(tx: Transaction): string | null {
  return (tx.id ?? tx.transactionId ?? tx.oid ?? null) as string | null;
}

function txLabel(type: unknown): string {
  if (!type) return "—";
  return TRANSACTION_TYPES[String(type)] ?? String(type);
}

export default function AzpetrolPage() {
  const { t } = useLanguage();

  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cardNumber, setCardNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetchInfo, setFetchInfo] = useState("");
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rawResponse, setRawResponse] = useState<object | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<object | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  function buildChunks(fromStr: string, toStr: string): Array<{ start: string; end: string }> {
    const chunks: Array<{ start: string; end: string }> = [];
    let cursor = new Date(fromStr);
    const end = new Date(toStr);
    while (cursor <= end) {
      const monthEnd = endOfMonth(cursor);
      chunks.push({
        start: format(cursor, "yyyy-MM-dd"),
        end: format(monthEnd < end ? monthEnd : end, "yyyy-MM-dd"),
      });
      cursor = startOfMonth(addMonths(cursor, 1));
    }
    return chunks;
  }

  async function handleSearch() {
    if (new Date(from) > new Date(to)) {
      setError("'From' date must be before 'To' date.");
      return;
    }

    const chunks = buildChunks(from, to);
    setLoading(true);
    setFetchInfo(`Fetching ${chunks.length} month${chunks.length !== 1 ? "s" : ""}…`);
    setError("");
    setTransactions([]);
    setRawResponse(null);
    setSelectedId(null);
    setDetail(null);

    try {
      const results = await Promise.all(
        chunks.map(async ({ start, end }) => {
          const body: Record<string, string> = {
            StartDate: `${start}T00:00:00`,
            EndDate: `${end}T23:59:59`,
          };
          if (cardNumber.trim()) body.CardNumber = cardNumber.trim();

          const res = await fetch("/api/azpetrol/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
          if (json.isSuccess === false) throw new Error(json.message ?? json.title ?? "Request failed");
          return json;
        })
      );

      const all: Transaction[] = [];
      for (const json of results) {
        const data = json.data;
        if (Array.isArray(data)) all.push(...(data as Transaction[]));
        else if (data && typeof data === "object") all.push(data as Transaction);
      }

      setTransactions(all);
      setRawResponse(
        chunks.length === 1
          ? results[0]
          : ({ chunks: chunks.length, total: all.length } as object)
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setFetchInfo("");
    }
  }

  async function handleRowClick(tx: Transaction) {
    const id = txId(tx);
    if (!id) return;

    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }

    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/azpetrol/transactions/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDetail(json);
    } catch (err) {
      setDetailError(String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <AppShell title="Azpetrol Transactions" eyebrow={t("attendanceTracker")}>
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Card Number (optional)</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="957113253"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 w-36"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {loading && fetchInfo ? fetchInfo : "Search"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Results table */}
      {transactions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
            </span>
            {txId(transactions[0]) && (
              <span className="text-xs text-slate-400">Click row for detail</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left w-4"></th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Time</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Card Holder</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Card #</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Product</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Qty</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Amount</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Station</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Plate</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx, i) => {
                  const id = txId(tx);
                  const isSelected = id && selectedId === id;
                  return (
                    <>
                      <tr
                        key={i}
                        onClick={() => handleRowClick(tx)}
                        className={`transition ${id ? "cursor-pointer hover:bg-slate-50" : ""} ${isSelected ? "bg-slate-50" : ""}`}
                      >
                        <td className="px-3 py-2 text-slate-400">
                          {id && (isSelected ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          {String(tx.transactionTimeStr ?? tx.transactionTime ?? "—")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{String(tx.cardHolderName ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{String(tx.cardNumber ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{String(tx.productName ?? "—")}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {tx.productQuantity != null ? `${tx.productQuantity} ${tx.productMeasure ?? ""}`.trim() : "—"}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                          {tx.amount != null ? `${Number(tx.amount).toFixed(2)} AZN` : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{String(tx.stationName ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{String(tx.plate ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                          {txLabel(tx.transactionType)}
                        </td>
                      </tr>
                      {isSelected && (
                        <tr key={`${i}-detail`}>
                          <td colSpan={10} className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                            {detailLoading && (
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Loader2 size={14} className="animate-spin" /> Loading detail…
                              </div>
                            )}
                            {detailError && (
                              <p className="text-xs text-red-600">{detailError}</p>
                            )}
                            {detail && !detailLoading && (
                              <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words max-h-64">
                                {JSON.stringify(detail, null, 2)}
                              </pre>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw response for debugging */}
      {rawResponse && transactions.length === 0 && !error && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Raw response (no transactions parsed):</p>
          <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words max-h-96">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </div>
      )}

      {!loading && transactions.length === 0 && !error && rawResponse && (
        <p className="text-sm text-slate-400 text-center py-8">No transactions found for this range.</p>
      )}
    </AppShell>
  );
}
