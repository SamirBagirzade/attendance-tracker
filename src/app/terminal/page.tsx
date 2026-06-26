"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";

type DashboardData = {
  totalEmployees: number;
  employeesWithoutRecord: number;
  statusCounts: Record<string, number>;
  maintenanceAlerts: { id: number; makeModel: string; licensePlate: string; type: string; severity: "warning" | "overdue" }[];
  fuelThisMonth: { total: number; count: number };
  fuelLastMonth: { total: number; count: number };
  attendanceTrend: { date: string; present: number }[];
};

const S: Record<string, string> = {
  ISDE: "ACTIVE",
  EZAMIYYET: "MISSION",
  MEZUNIYYET: "LEAVE",
  XESTE: "MEDICAL",
  BAYRAM: "HOLIDAY",
  ICAZELI: "PERMIT",
  ISTIRAHET: "STANDBY",
  ISDE_DEYIL: "ABSENT",
  ISDE_XESARET: "INJURED",
};

const MAINT: Record<string, string> = {
  OIL_CHANGE: "OIL CHG",
  INSURANCE: "INSUR",
  INSPECTION: "INSP",
};

function Clock() {
  const [t, setT] = useState("");
  const [d, setD] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setT(now.toLocaleTimeString("en-US", { hour12: false }));
      setD(now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "2-digit" }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="tabular-nums">
      <span style={{ color: "#ff6600" }}>{t}</span>
      <span style={{ color: "#555" }}> / </span>
      <span style={{ color: "#888" }}>{d}</span>
    </span>
  );
}

function Sep() {
  return <div style={{ borderTop: "1px solid #1a1a1a", margin: "0" }} />;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#ff6600", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>{children}</span>;
}

function Val({ children, dim, red, green }: { children: React.ReactNode; dim?: boolean; red?: boolean; green?: boolean }) {
  const color = red ? "#ff3333" : green ? "#33cc33" : dim ? "#555" : "#fff";
  return <span style={{ color, fontWeight: dim ? 400 : 600 }}>{children}</span>;
}

export default function Terminal() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/dashboard").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setData(d); }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const statusEntries = data ? Object.entries(data.statusCounts).sort((a, b) => b[1] - a[1]) : [];
  const totalRecords = statusEntries.reduce((s, [, n]) => s + n, 0);
  const fuelPct = data && data.fuelLastMonth.total > 0
    ? ((data.fuelThisMonth.total - data.fuelLastMonth.total) / data.fuelLastMonth.total) * 100
    : null;
  const coveragePct = data && data.totalEmployees > 0
    ? Math.round((totalRecords / data.totalEmployees) * 100)
    : 0;
  const overdueCount = data?.maintenanceAlerts.filter((a) => a.severity === "overdue").length ?? 0;
  const warnCount = data?.maintenanceAlerts.filter((a) => a.severity === "warning").length ?? 0;
  const avgPresent = data?.attendanceTrend.length
    ? Math.round(data.attendanceTrend.reduce((s, d) => s + d.present, 0) / data.attendanceTrend.length)
    : 0;

  const baseStyle: React.CSSProperties = {
    background: "#000",
    color: "#ccc",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 11,
    minHeight: "100vh",
    lineHeight: 1.4,
  };

  const panelStyle: React.CSSProperties = {
    border: "1px solid #1e1e1e",
    background: "#050505",
  };

  return (
    <div style={baseStyle}>

      {/* Top bar */}
      <div style={{ background: "#ff6600", padding: "3px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#000", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em" }}>
          HELIND CORP  //  ATTENDANCE MANAGEMENT SYSTEM  //  TERMINAL VIEW
        </span>
        <Link href="/" style={{ color: "#000", fontSize: 10, textDecoration: "none", fontWeight: 700, letterSpacing: "0.1em" }}>
          ← MAIN DASHBOARD
        </Link>
      </div>

      {/* Second bar — time + live */}
      <div style={{ background: "#0a0a0a", padding: "3px 10px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1a1a1a" }}>
        <Clock />
        <span style={{ color: "#ff6600", fontSize: 9, letterSpacing: "0.2em" }}>● LIVE  AUTO-REFRESH 60s</span>
      </div>

      {/* Ticker strip */}
      <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "5px 10px", display: "flex", gap: 0 }}>
        {[
          { label: "EMPLOYEES", val: data?.totalEmployees ?? "—", suffix: "" },
          { label: "ON DUTY TODAY", val: totalRecords, suffix: "" },
          { label: "COVERAGE", val: data ? `${coveragePct}%` : "—", suffix: "", color: coveragePct < 50 ? "#ff3333" : coveragePct < 80 ? "#ffaa00" : "#33cc33" },
          { label: "NO RECORD", val: data?.employeesWithoutRecord ?? "—", suffix: "", color: (data?.employeesWithoutRecord ?? 0) > 0 ? "#ffaa00" : "#33cc33" },
          { label: "FUEL MTD", val: data ? `${data.fuelThisMonth.total.toFixed(2)} AZN` : "—", suffix: "" },
          { label: "VS PREV MO", val: fuelPct !== null ? `${fuelPct > 0 ? "+" : ""}${fuelPct.toFixed(1)}%` : "—", suffix: "", color: fuelPct !== null ? (fuelPct > 0 ? "#ff3333" : "#33cc33") : "#888" },
          { label: "FILL-UPS", val: data?.fuelThisMonth.count ?? "—", suffix: "" },
          { label: "MAINT ALERTS", val: data?.maintenanceAlerts.length ?? "—", suffix: "", color: overdueCount > 0 ? "#ff3333" : (data?.maintenanceAlerts.length ?? 0) > 0 ? "#ffaa00" : "#33cc33" },
          { label: "AVG PRESENT/DAY", val: data ? avgPresent : "—", suffix: "" },
        ].map((item, i) => (
          <div key={i} style={{ borderLeft: i === 0 ? "none" : "1px solid #1e1e1e", padding: "0 16px 0 16px", minWidth: 100 }}>
            <div style={{ color: "#ff6600", fontSize: 8, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 1 }}>{item.label}</div>
            <div style={{ color: (item as { color?: string }).color ?? "#fff", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>
              {item.val}{item.suffix}
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 260px", gap: 1, padding: 1, background: "#111" }}>

        {/* LEFT — Status table */}
        <div style={panelStyle}>
          <div style={{ padding: "4px 8px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a" }}>
            <Label>STATUS BREAKDOWN  //  TODAY</Label>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                {["STATUS", "COUNT", "SHARE", "BAR"].map((h) => (
                  <td key={h} style={{ padding: "3px 8px", color: "#444", fontSize: 9, letterSpacing: "0.1em" }}>{h}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={4} style={{ padding: "8px", color: "#333" }}>LOADING...</td></tr>
              ) : statusEntries.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "8px", color: "#333" }}>NO RECORDS</td></tr>
              ) : (
                statusEntries.map(([status, count]) => {
                  const pct = totalRecords > 0 ? (count / totalRecords) * 100 : 0;
                  const barW = Math.round(pct / 100 * 40);
                  return (
                    <tr key={status} style={{ borderBottom: "1px solid #0d0d0d" }}>
                      <td style={{ padding: "3px 8px", color: "#ff6600", fontWeight: 700, fontSize: 10 }}>{S[status] ?? status}</td>
                      <td style={{ padding: "3px 8px", color: "#fff", fontWeight: 700, textAlign: "right" }}>{count}</td>
                      <td style={{ padding: "3px 8px", color: "#888", textAlign: "right" }}>{pct.toFixed(1)}%</td>
                      <td style={{ padding: "3px 8px" }}>
                        <div style={{ background: "#1a1a1a", height: 6, width: 40 }}>
                          <div style={{ background: "#ff6600", height: 6, width: barW }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {data && (data.employeesWithoutRecord ?? 0) > 0 && (
                <tr style={{ borderTop: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "3px 8px", color: "#444", fontSize: 10 }}>NO RECORD</td>
                  <td style={{ padding: "3px 8px", color: "#555", fontWeight: 700, textAlign: "right" }}>{data.employeesWithoutRecord}</td>
                  <td style={{ padding: "3px 8px", color: "#333", textAlign: "right" }}>
                    {data.totalEmployees > 0 ? ((data.employeesWithoutRecord / data.totalEmployees) * 100).toFixed(1) : "0.0"}%
                  </td>
                  <td style={{ padding: "3px 8px" }}>
                    <div style={{ background: "#1a1a1a", height: 6, width: 40 }}>
                      <div style={{ background: "#333", height: 6, width: data.totalEmployees > 0 ? Math.round((data.employeesWithoutRecord / data.totalEmployees) * 40) : 0 }} />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Fuel comparison table */}
          <div style={{ marginTop: 1, borderTop: "1px solid #1a1a1a" }}>
            <div style={{ padding: "4px 8px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a" }}>
              <Label>FUEL  //  MTD COMPARISON</Label>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                  {["PERIOD", "AZN", "FILLS", "DELTA"].map((h) => (
                    <td key={h} style={{ padding: "3px 8px", color: "#444", fontSize: 9, letterSpacing: "0.1em" }}>{h}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr><td colSpan={4} style={{ padding: "8px", color: "#333" }}>LOADING...</td></tr>
                ) : (
                  <>
                    <tr style={{ borderBottom: "1px solid #0d0d0d" }}>
                      <td style={{ padding: "3px 8px", color: "#ff6600", fontWeight: 700, fontSize: 10 }}>THIS MO</td>
                      <td style={{ padding: "3px 8px", color: "#fff", fontWeight: 700, textAlign: "right" }}>{data.fuelThisMonth.total.toFixed(2)}</td>
                      <td style={{ padding: "3px 8px", color: "#888", textAlign: "right" }}>{data.fuelThisMonth.count}</td>
                      <td style={{ padding: "3px 8px", textAlign: "right" }}>
                        {fuelPct !== null
                          ? <span style={{ color: fuelPct > 0 ? "#ff3333" : "#33cc33", fontWeight: 700 }}>{fuelPct > 0 ? "▲" : "▼"}{Math.abs(fuelPct).toFixed(1)}%</span>
                          : <span style={{ color: "#333" }}>—</span>}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "3px 8px", color: "#555", fontSize: 10 }}>PREV MO</td>
                      <td style={{ padding: "3px 8px", color: "#666", textAlign: "right" }}>{data.fuelLastMonth.total.toFixed(2)}</td>
                      <td style={{ padding: "3px 8px", color: "#444", textAlign: "right" }}>{data.fuelLastMonth.count}</td>
                      <td style={{ padding: "3px 8px", color: "#333", textAlign: "right" }}>BASE</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CENTER — Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>

          {/* Attendance line chart */}
          <div style={panelStyle}>
            <div style={{ padding: "4px 8px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Label>ATTENDANCE TREND  //  LAST 30 DAYS  //  PRESENT + MISSION</Label>
              {data && <span style={{ color: "#555", fontSize: 9 }}>AVG {avgPresent} / DAY  ·  PEAK {data ? Math.max(...data.attendanceTrend.map((d) => d.present)) : 0}</span>}
            </div>
            <div style={{ padding: "8px 4px 4px 4px", height: 140 }}>
              {!data ? (
                <div style={{ height: 130, background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}>LOADING DATA...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.attendanceTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={false} axisLine={{ stroke: "#1a1a1a" }} tickLine={false} />
                    <YAxis
                      tick={{ fill: "#444", fontSize: 9, fontFamily: "Courier New" }}
                      axisLine={false} tickLine={false}
                      domain={[0, data.totalEmployees]}
                    />
                    <ReferenceLine y={avgPresent} stroke="#ff660033" strokeDasharray="4 4" />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div style={{ background: "#000", border: "1px solid #ff6600", padding: "4px 8px", fontSize: 10, fontFamily: "Courier New", color: "#ff6600" }}>
                            {payload[0].payload.date}<br />
                            <span style={{ color: "#555" }}>PRESENT: </span>
                            <span style={{ color: "#fff", fontWeight: 700 }}>{payload[0].value}</span>
                          </div>
                        ) : null
                      }
                    />
                    <Line type="monotone" dataKey="present" stroke="#ff6600" strokeWidth={1} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Fuel bar chart */}
          <div style={{ ...panelStyle, flex: 1 }}>
            <div style={{ padding: "4px 8px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a", display: "flex", justifyContent: "space-between" }}>
              <Label>DAILY FUEL SPEND  //  THIS MONTH FILL-UPS</Label>
              {data && <span style={{ color: "#555", fontSize: 9 }}>TOTAL {data.fuelThisMonth.total.toFixed(2)} AZN  ·  {data.fuelThisMonth.count} FILL-UPS</span>}
            </div>
            <div style={{ padding: "8px 4px 4px 4px", height: 100 }}>
              {!data ? (
                <div style={{ height: 92, background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}>LOADING DATA...</div>
              ) : data.fuelThisMonth.count === 0 ? (
                <div style={{ height: 92, display: "flex", alignItems: "center", justifyContent: "center", color: "#222", fontSize: 10 }}>NO FUEL TRANSACTIONS THIS MONTH</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.attendanceTrend} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={false} axisLine={{ stroke: "#1a1a1a" }} tickLine={false} />
                    <YAxis tick={{ fill: "#444", fontSize: 9, fontFamily: "Courier New" }} axisLine={false} tickLine={false} />
                    <Bar dataKey="present" fill="#ff660033" stroke="#ff6600" strokeWidth={0} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Alerts */}
        <div style={panelStyle}>
          <div style={{ padding: "4px 8px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a", display: "flex", justifyContent: "space-between" }}>
            <Label>VEHICLE ALERTS</Label>
            {data && <span style={{ color: overdueCount > 0 ? "#ff3333" : "#555", fontSize: 9, fontWeight: 700 }}>{data.maintenanceAlerts.length} TOTAL</span>}
          </div>

          {/* Overdue */}
          {(data?.maintenanceAlerts.filter((a) => a.severity === "overdue").length ?? 0) > 0 && (
            <>
              <div style={{ padding: "2px 8px", background: "#1a0000", borderBottom: "1px solid #330000" }}>
                <span style={{ color: "#ff3333", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>▼ OVERDUE</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {data!.maintenanceAlerts.filter((a) => a.severity === "overdue").map((a, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                      <td style={{ padding: "3px 8px" }}>
                        <div style={{ color: "#ff3333", fontWeight: 700, fontSize: 10 }}>{a.licensePlate}</div>
                        <div style={{ color: "#444", fontSize: 9 }}>{a.makeModel}</div>
                      </td>
                      <td style={{ padding: "3px 8px", textAlign: "right" }}>
                        <span style={{ color: "#ff3333", fontWeight: 700, fontSize: 9 }}>{MAINT[a.type] ?? a.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Warning */}
          {(data?.maintenanceAlerts.filter((a) => a.severity === "warning").length ?? 0) > 0 && (
            <>
              <div style={{ padding: "2px 8px", background: "#0d0900", borderBottom: "1px solid #1a1200", marginTop: 1 }}>
                <span style={{ color: "#ffaa00", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>▼ WARNING</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {data!.maintenanceAlerts.filter((a) => a.severity === "warning").map((a, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                      <td style={{ padding: "3px 8px" }}>
                        <div style={{ color: "#ffaa00", fontWeight: 700, fontSize: 10 }}>{a.licensePlate}</div>
                        <div style={{ color: "#444", fontSize: 9 }}>{a.makeModel}</div>
                      </td>
                      <td style={{ padding: "3px 8px", textAlign: "right" }}>
                        <span style={{ color: "#ffaa00", fontWeight: 700, fontSize: 9 }}>{MAINT[a.type] ?? a.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {data?.maintenanceAlerts.length === 0 && (
            <div style={{ padding: "12px 8px", color: "#33cc33", fontSize: 10, letterSpacing: "0.1em" }}>ALL SYSTEMS NOMINAL</div>
          )}

          {!data && (
            <div style={{ padding: "8px", color: "#333" }}>LOADING...</div>
          )}

          {/* Quick stats footer */}
          <div style={{ marginTop: "auto", borderTop: "1px solid #1a1a1a", padding: "6px 8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["OVERDUE", overdueCount, overdueCount > 0 ? "#ff3333" : "#333"],
                  ["WARNING", warnCount, warnCount > 0 ? "#ffaa00" : "#333"],
                  ["CLEAR", Math.max(0, (data?.maintenanceAlerts.length ?? 0) - overdueCount - warnCount), "#333"],
                ].map(([label, val, color]) => (
                  <tr key={String(label)}>
                    <td style={{ padding: "1px 0", color: "#444", fontSize: 9, letterSpacing: "0.1em" }}>{label}</td>
                    <td style={{ padding: "1px 0", textAlign: "right", color: color as string, fontWeight: 700 }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "2px 10px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#333", fontSize: 9, letterSpacing: "0.1em" }}>
          HELIND CORP  ·  ATTENDANCE TRACKER v3  ·  TERMINAL VIEW
        </span>
        <span style={{ color: "#ff660066", fontSize: 9, letterSpacing: "0.1em" }}>
          DATA REFRESHES EVERY 60s  ·  ALL TIMES LOCAL
        </span>
      </div>
    </div>
  );
}
