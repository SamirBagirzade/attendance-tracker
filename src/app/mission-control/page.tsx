"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { Activity, AlertTriangle, ArrowLeft, Car, Cpu, Users, Zap } from "lucide-react";

type DashboardData = {
  totalEmployees: number;
  employeesWithoutRecord: number;
  statusCounts: Record<string, number>;
  maintenanceAlerts: { id: number; makeModel: string; licensePlate: string; type: string; severity: "warning" | "overdue" }[];
  fuelThisMonth: { total: number; count: number };
  fuelLastMonth: { total: number; count: number };
  attendanceTrend: { date: string; present: number }[];
};

const STATUS_LABELS: Record<string, string> = {
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

const STATUS_COLORS: Record<string, string> = {
  ISDE: "#00ff41",
  EZAMIYYET: "#00cfff",
  MEZUNIYYET: "#f0a500",
  XESTE: "#ff4444",
  BAYRAM: "#bf7fff",
  ICAZELI: "#ff8c00",
  ISTIRAHET: "#4a9eff",
  ISDE_DEYIL: "#555",
  ISDE_XESARET: "#ff2d55",
};

const MAINT_LABELS: Record<string, string> = {
  OIL_CHANGE: "OIL",
  INSURANCE: "INS",
  INSPECTION: "INSP",
};

function Scanline() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.015) 2px, rgba(0,255,65,0.015) 4px)",
      }}
    />
  );
}

function GlowBorder({ children, color = "#00ff41", className = "" }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <div
      className={`relative rounded-sm border bg-black/80 backdrop-blur-sm ${className}`}
      style={{
        borderColor: color + "55",
        boxShadow: `0 0 12px ${color}22, inset 0 0 12px ${color}08`,
      }}
    >
      {/* corner accents */}
      <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: color }} />
      <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: color }} />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: color }} />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: color }} />
      {children}
    </div>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
        style={{ backgroundColor: color, animationDuration: "2s" }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: "#00ff41", textShadow: "0 0 12px #00ff41" }}>{time}</span>;
}

export default function MissionControl() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tick, setTick] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d as DashboardData); })
      .catch(() => {});
    // refresh every 60s
    const id = setInterval(() => {
      setTick((t) => t + 1);
      fetch("/api/dashboard").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setData(d as DashboardData); }).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // subtle flicker on frame
  useEffect(() => {
    let f = 0;
    const run = () => { f++; if (f % 300 === 0) setTick((t) => t + 1); frameRef.current = requestAnimationFrame(run); };
    frameRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const statusEntries = data ? Object.entries(data.statusCounts).sort((a, b) => b[1] - a[1]) : [];
  const totalRecords = statusEntries.reduce((s, [, n]) => s + n, 0);
  const fuelPct = data && data.fuelLastMonth.total > 0
    ? ((data.fuelThisMonth.total - data.fuelLastMonth.total) / data.fuelLastMonth.total) * 100
    : null;

  const overdueCount = data?.maintenanceAlerts.filter((a) => a.severity === "overdue").length ?? 0;
  const warnCount = data?.maintenanceAlerts.filter((a) => a.severity === "warning").length ?? 0;

  return (
    <div
      className="min-h-screen relative overflow-hidden select-none"
      style={{ background: "radial-gradient(ellipse at top, #060d14 0%, #020508 60%, #000 100%)", fontFamily: "monospace" }}
    >
      <Scanline />

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "linear-gradient(rgba(0,207,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,207,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 p-4 md:p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-sm border transition-all"
              style={{ borderColor: "#00cfff44", color: "#00cfff", boxShadow: "0 0 8px #00cfff22" }}
            >
              <ArrowLeft size={12} />
              EXIT
            </Link>
            <div>
              <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "#00cfff99" }}>SYSTEM // MISSION CONTROL</p>
              <p className="text-xs" style={{ color: "#ffffff33" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <PulsingDot color="#00ff41" />
              <span className="text-xs tracking-widest" style={{ color: "#00ff4188" }}>LIVE</span>
            </div>
            <Clock />
          </div>
        </div>

        {/* Top metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">

          {/* Total personnel */}
          <GlowBorder color="#00cfff" className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs tracking-widest mb-1" style={{ color: "#00cfff66" }}>PERSONNEL</p>
                <p className="text-4xl font-bold tabular-nums" style={{ color: "#00cfff", textShadow: "0 0 16px #00cfff" }}>
                  {data?.totalEmployees ?? "—"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#ffffff44" }}>TOTAL ACTIVE</p>
              </div>
              <Users size={20} style={{ color: "#00cfff44" }} />
            </div>
          </GlowBorder>

          {/* On duty now */}
          <GlowBorder color="#00ff41" className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs tracking-widest mb-1" style={{ color: "#00ff4166" }}>ON DUTY</p>
                <p className="text-4xl font-bold tabular-nums" style={{ color: "#00ff41", textShadow: "0 0 16px #00ff41" }}>
                  {totalRecords}
                </p>
                <p className="text-xs mt-1" style={{ color: "#ffffff44" }}>TODAY / {data?.totalEmployees ?? "—"}</p>
              </div>
              <Activity size={20} style={{ color: "#00ff4144" }} />
            </div>
          </GlowBorder>

          {/* Fuel spend */}
          <GlowBorder color="#f0a500" className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs tracking-widest mb-1" style={{ color: "#f0a50066" }}>FUEL // MTD</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: "#f0a500", textShadow: "0 0 16px #f0a500" }}>
                  {data ? data.fuelThisMonth.total.toFixed(0) : "—"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#ffffff44" }}>
                  AZN
                  {fuelPct !== null && (
                    <span style={{ color: fuelPct > 0 ? "#ff4444" : "#00ff41", marginLeft: 6 }}>
                      {fuelPct > 0 ? "▲" : "▼"}{Math.abs(fuelPct).toFixed(1)}%
                    </span>
                  )}
                </p>
              </div>
              <Zap size={20} style={{ color: "#f0a50044" }} />
            </div>
          </GlowBorder>

          {/* Maintenance */}
          <GlowBorder color={overdueCount > 0 ? "#ff4444" : "#555"} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs tracking-widest mb-1" style={{ color: "#ff444466" }}>MAINT. ALERTS</p>
                <p className="text-4xl font-bold tabular-nums" style={{ color: overdueCount > 0 ? "#ff4444" : "#555", textShadow: overdueCount > 0 ? "0 0 16px #ff4444" : "none" }}>
                  {overdueCount + warnCount}
                </p>
                <p className="text-xs mt-1" style={{ color: "#ffffff44" }}>
                  {overdueCount > 0 && <span style={{ color: "#ff4444" }}>{overdueCount} OVERDUE </span>}
                  {warnCount > 0 && <span style={{ color: "#f0a500" }}>{warnCount} WARN</span>}
                  {overdueCount === 0 && warnCount === 0 && "ALL CLEAR"}
                </p>
              </div>
              <Car size={20} style={{ color: overdueCount > 0 ? "#ff444444" : "#55555544" }} />
            </div>
          </GlowBorder>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">

          {/* Status breakdown */}
          <GlowBorder color="#00cfff" className="p-4 lg:col-span-1">
            <p className="text-xs tracking-[0.25em] mb-4" style={{ color: "#00cfff66" }}>// STATUS MATRIX</p>
            {!data ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 rounded animate-pulse" style={{ background: "#00cfff11" }} />
                ))}
              </div>
            ) : statusEntries.length === 0 ? (
              <p className="text-xs" style={{ color: "#ffffff33" }}>NO RECORDS TODAY</p>
            ) : (
              <div className="space-y-2">
                {statusEntries.map(([status, count]) => {
                  const color = STATUS_COLORS[status] ?? "#555";
                  const pct = totalRecords > 0 ? (count / totalRecords) * 100 : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <PulsingDot color={color} />
                          <span className="text-xs tracking-wider" style={{ color: color + "cc" }}>{STATUS_LABELS[status] ?? status}</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums" style={{ color }}>{count}</span>
                      </div>
                      <div className="h-1 w-full rounded-full" style={{ background: "#ffffff0a" }}>
                        <div
                          className="h-1 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {(data.employeesWithoutRecord ?? 0) > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #ffffff11" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs tracking-wider" style={{ color: "#ffffff33" }}>NO RECORD</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: "#ffffff33" }}>{data.employeesWithoutRecord}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlowBorder>

          {/* Attendance trend chart */}
          <GlowBorder color="#00ff41" className="p-4 lg:col-span-2">
            <p className="text-xs tracking-[0.25em] mb-4" style={{ color: "#00ff4166" }}>// 30-DAY ATTENDANCE FEED</p>
            {!data ? (
              <div className="h-32 animate-pulse rounded" style={{ background: "#00ff4108" }} />
            ) : (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.attendanceTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="neonGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00ff41" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={false} axisLine={{ stroke: "#00ff4122" }} tickLine={false} />
                    <YAxis tick={{ fill: "#00ff4166", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="rounded-sm border px-3 py-1.5 text-xs font-mono" style={{ background: "#020508ee", borderColor: "#00ff4133", color: "#00ff41" }}>
                            {payload[0].payload.date}<br />
                            <span style={{ color: "#ffffff88" }}>PRESENT: </span>
                            <span style={{ color: "#00ff41" }}>{payload[0].value}</span>
                          </div>
                        ) : null
                      }
                    />
                    <Area type="monotone" dataKey="present" stroke="#00ff41" strokeWidth={1.5} fill="url(#neonGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlowBorder>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Fuel by fill-ups bar */}
          <GlowBorder color="#f0a500" className="p-4">
            <p className="text-xs tracking-[0.25em] mb-1" style={{ color: "#f0a50066" }}>// FUEL CONSUMPTION TREND</p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-2xl font-bold tabular-nums" style={{ color: "#f0a500", textShadow: "0 0 12px #f0a500" }}>
                {data ? data.fuelThisMonth.total.toFixed(2) : "—"} AZN
              </span>
              <span className="text-xs" style={{ color: "#ffffff33" }}>THIS MONTH · {data?.fuelThisMonth.count ?? 0} FILL-UPS</span>
            </div>
            {data && data.fuelLastMonth.total > 0 && (
              <div className="space-y-2">
                {[
                  { label: "THIS MONTH", value: data.fuelThisMonth.total, color: "#f0a500" },
                  { label: "LAST MONTH", value: data.fuelLastMonth.total, color: "#f0a50055" },
                ].map(({ label, value, color }) => {
                  const max = Math.max(data.fuelThisMonth.total, data.fuelLastMonth.total);
                  const pct = max > 0 ? (value / max) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1" style={{ color: "#ffffff44" }}>
                        <span>{label}</span>
                        <span style={{ color }}>{value.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full" style={{ background: "#ffffff0a" }}>
                        <div className="h-1.5 rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {data && data.fuelThisMonth.count === 0 && (
              <p className="text-xs" style={{ color: "#ffffff22" }}>NO FUEL DATA THIS MONTH</p>
            )}
          </GlowBorder>

          {/* Maintenance alerts */}
          <GlowBorder color={overdueCount > 0 ? "#ff4444" : "#00cfff"} className="p-4">
            <p className="text-xs tracking-[0.25em] mb-3" style={{ color: overdueCount > 0 ? "#ff444466" : "#00cfff66" }}>// VEHICLE ALERT LOG</p>
            {!data ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded" style={{ background: "#ff444411" }} />)}
              </div>
            ) : data.maintenanceAlerts.length === 0 ? (
              <div className="flex items-center gap-3 mt-2">
                <PulsingDot color="#00ff41" />
                <span className="text-sm tracking-widest" style={{ color: "#00ff41" }}>ALL SYSTEMS NOMINAL</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {data.maintenanceAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-sm text-xs"
                    style={{
                      background: alert.severity === "overdue" ? "#ff444411" : "#f0a50011",
                      borderLeft: `2px solid ${alert.severity === "overdue" ? "#ff4444" : "#f0a500"}`,
                    }}
                  >
                    <AlertTriangle size={11} style={{ color: alert.severity === "overdue" ? "#ff4444" : "#f0a500", flexShrink: 0 }} />
                    <span className="truncate font-mono" style={{ color: "#ffffff88" }}>{alert.makeModel} · {alert.licensePlate}</span>
                    <span className="ml-auto shrink-0 font-bold tracking-wider" style={{ color: alert.severity === "overdue" ? "#ff4444" : "#f0a500" }}>
                      {MAINT_LABELS[alert.type] ?? alert.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlowBorder>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs tracking-widest" style={{ color: "#ffffff11" }}>
            HELIND CORP · ATTENDANCE MANAGEMENT SYSTEM v3
          </p>
          <div className="flex items-center gap-2">
            <Cpu size={10} style={{ color: "#00ff4133" }} />
            <span className="text-xs" style={{ color: "#00ff4133" }}>SYS ONLINE</span>
          </div>
        </div>

      </div>
    </div>
  );
}
