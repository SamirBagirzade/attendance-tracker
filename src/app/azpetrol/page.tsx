"use client";

import { useState, useEffect } from "react";
import { format, subDays, endOfMonth, startOfMonth, addMonths } from "date-fns";
import { Search, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/lib/i18n";

type Tab = "query" | "sync" | "external";

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

function SyncTab() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> & { sampleKeys?: string[]; sampleTx?: object } | null>(null);
  const [syncError, setSyncError] = useState("");
  const [stats, setStats] = useState<{ total: number; earliest: string | null; latest: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/azpetrol/sync")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const res = await fetch("/api/azpetrol/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSyncResult(json);
      // Refresh stats
      fetch("/api/azpetrol/sync").then((r) => r.json()).then(setStats).catch(() => {});
    } catch (err) {
      setSyncError(String(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Cached Transactions</p>
            <p className="text-xl font-semibold text-slate-900">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Earliest</p>
            <p className="text-sm font-medium text-slate-700">{stats.earliest ? format(new Date(stats.earliest), "dd.MM.yyyy") : "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Latest</p>
            <p className="text-sm font-medium text-slate-700">{stats.latest ? format(new Date(stats.latest), "dd.MM.yyyy HH:mm") : "—"}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4 items-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 mb-1">Manual Sync</p>
          <p className="text-xs text-slate-500">Fetches Card Sale transactions from last synced date to today and upserts into local DB. Skips non-company plates (they appear in External Vehicles tab).</p>
        </div>
        <button onClick={() => void handleSync()} disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition shrink-0">
          {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      </div>

      {syncError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{syncError}</div>}

      {syncResult && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${Number(syncResult.inserted) > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          Sync complete — fetched <strong>{String(syncResult.fetched)}</strong>, inserted/updated <strong>{String(syncResult.inserted)}</strong>,
          skipped <strong>{String(syncResult.skipped)}</strong> · range: {String(syncResult.fromDate)} → {String(syncResult.toDate)} ({String(syncResult.chunks)} chunk{Number(syncResult.chunks) !== 1 ? "s" : ""})
          {syncResult.sampleKeys && (
            <div className="mt-2">
              <p className="font-medium">Fields in transaction object: <code className="font-mono">{(syncResult.sampleKeys as string[]).join(", ")}</code></p>
              <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-48 bg-white/60 rounded p-2">{JSON.stringify(syncResult.sampleTx, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Hourly Auto-Sync (Cron)</p>
        <p className="text-xs text-slate-500 mb-3">Crontab entry (runs at top of every hour):</p>
        <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto">
{`0 * * * * /home/dietpi/attendance-tracker/scripts/sync-fuel.sh >> /home/dietpi/fuel-sync.log 2>&1`}
        </pre>
        <p className="text-xs text-slate-400 mt-2">Set <code>CRON_SECRET</code> in .env — the cron call bypasses session auth when this header matches.</p>
      </div>
    </div>
  );
}

function ExternalVehiclesTab() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [groups, setGroups] = useState<Array<{ plate: string; count: number; totalAmount: number; totalQuantity: number; transactions: unknown[] }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/azpetrol/external-vehicles?from=${from}&to=${to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setGroups(json.groups);
      setTotal(json.total);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Load
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {groups.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">{groups.length} external plates · {total} transactions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {groups.map((g) => (
              <div key={g.plate}>
                <button
                  onClick={() => setExpanded(expanded === g.plate ? null : g.plate)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left"
                >
                  {expanded === g.plate ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                  <span className="font-mono text-sm font-medium text-slate-800 w-28">{g.plate}</span>
                  <span className="text-sm text-slate-500">{g.count} fill-ups</span>
                  <span className="ml-auto text-sm font-medium text-slate-700">{g.totalAmount.toFixed(2)} AZN</span>
                  <span className="text-sm text-slate-500 ml-4">{g.totalQuantity.toFixed(2)} L</span>
                </button>
                {expanded === g.plate && (
                  <div className="px-4 pb-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="text-slate-500 uppercase">
                        <tr>
                          <th className="pr-4 py-1 text-left">Date</th>
                          <th className="pr-4 py-1 text-left">Product</th>
                          <th className="pr-4 py-1 text-right">Qty</th>
                          <th className="pr-4 py-1 text-right">Cost</th>
                          <th className="pr-4 py-1 text-left">Station</th>
                          <th className="py-1 text-left">Card Holder</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(g.transactions as Array<Record<string, unknown>>).map((tx, i) => (
                          <tr key={i} className="text-slate-700">
                            <td className="pr-4 py-1.5 whitespace-nowrap">{tx.transactionTime ? format(new Date(String(tx.transactionTime)), "dd.MM.yyyy HH:mm") : "—"}</td>
                            <td className="pr-4 py-1.5">{String(tx.productName ?? "—")}</td>
                            <td className="pr-4 py-1.5 text-right">{tx.productQuantity != null ? `${tx.productQuantity} ${tx.productMeasure ?? ""}`.trim() : "—"}</td>
                            <td className="pr-4 py-1.5 text-right font-medium">{Number(tx.amount).toFixed(2)} AZN</td>
                            <td className="pr-4 py-1.5">{String(tx.stationName ?? "—")}</td>
                            <td className="py-1.5">{String(tx.cardHolderName ?? "—")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && groups.length === 0 && total === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No external vehicle transactions found. Run a sync first.</p>
      )}
    </div>
  );
}

export default function AzpetrolPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("query");

  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cardNumber, setCardNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetchInfo, setFetchInfo] = useState("");
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rawResponse, setRawResponse] = useState<object | null>(null);

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<object | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [filters, setFilters] = useState({
    cardNumber: "", productName: "", minAmount: "", maxAmount: "",
    stationName: "", plate: "", transactionType: "",
  });

  const hasFilters = Object.values(filters).some(Boolean);

  const filteredTransactions = transactions.filter((tx) => {
    if (filters.cardNumber && !String(tx.cardNumber ?? "").toLowerCase().includes(filters.cardNumber.toLowerCase())) return false;
    if (filters.productName && String(tx.productName ?? "") !== filters.productName) return false;
    if (filters.minAmount && Number(tx.amount) < Number(filters.minAmount)) return false;
    if (filters.maxAmount && Number(tx.amount) > Number(filters.maxAmount)) return false;
    if (filters.stationName && String(tx.stationName ?? "") !== filters.stationName) return false;
    if (filters.plate && !String(tx.plate ?? "").toLowerCase().includes(filters.plate.toLowerCase())) return false;
    if (filters.transactionType && String(tx.transactionType ?? "") !== filters.transactionType) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const clampedPage = Math.min(page, Math.max(0, totalPages - 1));
  const pageSlice = filteredTransactions.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  const uniqueValues = (key: keyof Transaction) =>
    [...new Set(transactions.map((tx) => String(tx[key] ?? "")).filter(Boolean))].sort();

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
    setPage(0);
    setFilters({ cardNumber: "", productName: "", minAmount: "", maxAmount: "", stationName: "", plate: "", transactionType: "" });
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
    <AppShell title="Azpetrol" eyebrow={t("attendanceTracker")}>
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {(["query", "sync", "external"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t === "query" ? "Live Query" : t === "sync" ? "Sync" : "External Vehicles"}
          </button>
        ))}
      </div>

      {tab === "sync" && <SyncTab />}
      {tab === "external" && <ExternalVehiclesTab />}
      {tab === "query" && (<>
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
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-slate-700">
              {hasFilters
                ? `${filteredTransactions.length} of ${transactions.length} transactions`
                : `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}`}
              {totalPages > 1 && (
                <span className="ml-2 text-slate-400 text-xs">· page {clampedPage + 1}/{totalPages}</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              {hasFilters && (
                <button
                  onClick={() => { setFilters({ cardNumber: "", productName: "", minAmount: "", maxAmount: "", stationName: "", plate: "", transactionType: "" }); setPage(0); }}
                  className="text-xs text-slate-500 hover:text-red-500 transition"
                >
                  Clear filters
                </button>
              )}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={clampedPage >= totalPages - 1} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">Next</button>
                </div>
              )}
              {txId(transactions[0]) && (
                <span className="text-xs text-slate-400">Click row for detail</span>
              )}
            </div>
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
                <tr className="border-t border-slate-200 bg-white">
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filters.cardNumber} onChange={(e) => setFilters((f) => ({ ...f, cardNumber: e.target.value }))} placeholder="Filter…" className="w-full text-xs rounded border border-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 font-normal normal-case" />
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={filters.productName} onChange={(e) => setFilters((f) => ({ ...f, productName: e.target.value }))} className="w-full text-xs rounded border border-slate-200 px-1 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 font-normal normal-case">
                      <option value="">All</option>
                      {uniqueValues("productName").map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5">
                    <div className="flex gap-1">
                      <input type="number" value={filters.minAmount} onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))} placeholder="Min" className="w-14 text-xs rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 font-normal normal-case" />
                      <input type="number" value={filters.maxAmount} onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))} placeholder="Max" className="w-14 text-xs rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 font-normal normal-case" />
                    </div>
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={filters.stationName} onChange={(e) => setFilters((f) => ({ ...f, stationName: e.target.value }))} className="w-full text-xs rounded border border-slate-200 px-1 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 font-normal normal-case">
                      <option value="">All</option>
                      {uniqueValues("stationName").map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <input type="text" value={filters.plate} onChange={(e) => setFilters((f) => ({ ...f, plate: e.target.value }))} placeholder="Filter…" className="w-full text-xs rounded border border-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 font-normal normal-case" />
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={filters.transactionType} onChange={(e) => setFilters((f) => ({ ...f, transactionType: e.target.value }))} className="w-full text-xs rounded border border-slate-200 px-1 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 font-normal normal-case">
                      <option value="">All</option>
                      {uniqueValues("transactionType").map((v) => <option key={v} value={v}>{TRANSACTION_TYPES[v] ?? v}</option>)}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageSlice.map((tx, i) => {
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
      </>)}
    </AppShell>
  );
}
