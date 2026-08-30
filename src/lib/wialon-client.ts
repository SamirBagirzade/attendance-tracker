// Read lazily and check: non-null assertions at module load meant a missing var
// produced fetch("undefined?...") and NaN resource ids, failing in a way that
// pointed nowhere near the actual problem.
function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set — Wialon telemetry is not configured.`);
  }

  return value;
}

function requireEnvNumber(name: string): number {
  const value = Number(requireEnv(name));

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number.`);
  }

  return value;
}

// Wialon Local reports a hard "no valid reading" sentinel instead of null/0 —
// must not be treated as a real fuel/mileage value (would look like -348201L of fuel).
const NA_VALUE = -348201.3876;
// The sentinel reaches us either as the raw number in a cell's `v`, or already
// rendered into the cell's display text (sometimes with a unit suffix), so both
// forms have to be caught before a row is handed to the UI.
const NA_TEXT = "-348201";

function isNaReading(value: unknown): boolean {
  if (typeof value === "number") {
    return Math.abs(value - NA_VALUE) < 0.01;
  }

  if (typeof value === "string") {
    return value.includes(NA_TEXT);
  }

  if (value && typeof value === "object") {
    const cell = value as { t?: unknown; v?: unknown };
    return isNaReading(cell.v) || isNaReading(cell.t);
  }

  return false;
}

async function call(svc: string, params: Record<string, unknown>, sid?: string): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ svc, params: JSON.stringify(params) });
  if (sid) query.set("sid", sid);
  const res = await fetch(`${requireEnv("WIALON_API_URL")}?${query.toString()}`);
  if (!res.ok) throw new Error(`Wialon ${svc} HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  if (typeof json.error === "number" && json.error !== 0) {
    throw new Error(`Wialon ${svc} error ${json.error}: ${json.reason ?? ""}`);
  }
  return json;
}

type WialonUnit = {
  id: number;
  nm: string;
  pos?: { y: number; x: number; s: number; c: number; t: number };
  lmsg?: { t: number };
};

export type CurrentPosition = { lat: number; lon: number; speedKmh: number; course: number; timestampUtc: string } | null;

export type ReportRow = Record<string, string | number | null>;

export type FuelReportResult = {
  unitId: number;
  unitName: string;
  currentPosition: CurrentPosition;
  stats: Array<{ label: string; value: string }>;
  fillings: ReportRow[];
  leaks: ReportRow[];
  trips: ReportRow[];
};

function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, "").trim();
}

function findUnitForPlate(units: WialonUnit[], plate: string): WialonUnit | null {
  const target = normalizePlate(plate);
  for (const u of units) {
    const firstToken = u.nm.split(/\s+/)[0] ?? "";
    if (normalizePlate(firstToken) === target) return u;
  }
  // fallback: plate appears anywhere in the unit name
  return units.find((u) => normalizePlate(u.nm).includes(target)) ?? null;
}

function cellToRow(headerType: string[], c: unknown[]): ReportRow {
  const row: ReportRow = {};
  headerType.forEach((key, idx) => {
    if (!key) return; // row-number column has no header_type
    const cell = c[idx];
    if (isNaReading(cell)) {
      // No valid reading for this column — null, so the UI renders its own dash
      // rather than the raw sentinel.
      row[key] = null;
      return;
    }
    if (cell && typeof cell === "object") {
      const obj = cell as { t?: string; v?: number; y?: number; x?: number };
      row[key] = obj.t ?? null;
      if (obj.y !== undefined && obj.x !== undefined) {
        row[`${key}_lat`] = obj.y;
        row[`${key}_lon`] = obj.x;
      }
    } else {
      row[key] = cell as string | number;
    }
  });
  return row;
}

type RawResultRow = { c: unknown[] };

async function fetchAllRows(sid: string, tableIndex: number, rowCount: number): Promise<RawResultRow[]> {
  if (rowCount <= 0) return [];
  const rows: RawResultRow[] = [];
  const CHUNK = 200;
  for (let from = 0; from < rowCount; from += CHUNK) {
    const to = Math.min(from + CHUNK, rowCount) - 1;
    const json = (await call("report/get_result_rows", { tableIndex, indexFrom: from, indexTo: to }, sid)) as unknown as RawResultRow[];
    rows.push(...json);
  }
  return rows;
}

export async function getFuelReport(plate: string, fromUnix: number, toUnix: number): Promise<FuelReportResult> {
  const login = await call("token/login", { token: requireEnv("WIALON_TOKEN"), fl: 1 });
  const sid = login.eid as string;

  try {
    const search = await call(
      "core/search_items",
      {
        spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name", propType: "property", or_logic: 0 },
        force: 1,
        flags: 5121, // base info (0x1) + last position/message (0x400) + sensors (0x1000)
        from: 0,
        to: 0,
      },
      sid,
    );
    const units = (search.items ?? []) as WialonUnit[];
    const unit = findUnitForPlate(units, plate);
    if (!unit) throw new Error(`No matching Wialon unit found for plate "${plate}".`);

    const currentPosition: CurrentPosition = unit.pos
      ? { lat: unit.pos.y, lon: unit.pos.x, speedKmh: unit.pos.s, course: unit.pos.c, timestampUtc: new Date(unit.pos.t * 1000).toISOString() }
      : null;

    const exec = await call(
      "report/exec_report",
      {
        reportResourceId: requireEnvNumber("WIALON_RESOURCE_ID"),
        reportTemplateId: requireEnvNumber("WIALON_FUEL_TEMPLATE_ID"),
        reportObjectId: unit.id,
        reportObjectSecId: 0,
        interval: { from: fromUnix, to: toUnix, flags: 0 },
        lang: "en",
      },
      sid,
    );

    const reportResult = exec.reportResult as {
      stats: [string, string][];
      tables: Array<{ name: string; rows: number; header_type: string[] }>;
    };

    const stats = (reportResult.stats ?? []).map(([label, value]) => ({
      label,
      value: isNaReading(value) ? "—" : value,
    }));

    const fillingsTable = reportResult.tables.find((t) => t.name === "unit_fillings");
    const leaksTable = reportResult.tables.find((t) => t.name === "unit_thefts");
    const tripsTable = reportResult.tables.find((t) => t.name === "unit_trips");

    const [fillingsRaw, leaksRaw, tripsRaw] = await Promise.all([
      fillingsTable ? fetchAllRows(sid, reportResult.tables.indexOf(fillingsTable), fillingsTable.rows) : Promise.resolve([]),
      leaksTable ? fetchAllRows(sid, reportResult.tables.indexOf(leaksTable), leaksTable.rows) : Promise.resolve([]),
      tripsTable ? fetchAllRows(sid, reportResult.tables.indexOf(tripsTable), tripsTable.rows) : Promise.resolve([]),
    ]);

    const fillings = fillingsTable ? fillingsRaw.map((r) => cellToRow(fillingsTable.header_type, r.c)) : [];
    const leaks = leaksTable ? leaksRaw.map((r) => cellToRow(leaksTable.header_type, r.c)) : [];
    const trips = tripsTable ? tripsRaw.map((r) => cellToRow(tripsTable.header_type, r.c)) : [];

    await call("report/cleanup_result", {}, sid);

    return { unitId: unit.id, unitName: unit.nm, currentPosition, stats, fillings, leaks, trips };
  } finally {
    await call("core/logout", {}, sid).catch(() => {});
  }
}

export type UnitOdometer = {
  unitId: number;
  unitName: string;
  /** First whitespace-delimited token of the unit name — the plate, by convention here. */
  plateToken: string;
  km: number;
};

export type OdometerSkip = {
  unitName: string;
  reason: "no mileage sensor" | "no valid reading" | "sensor is not a distance";
};

// A sensor typed "mileage" is not enough on its own: one unit in this account
// has a sensor of that type wired to io_66, the supply voltage, which would
// otherwise be written in as ~12,836 km. Require the declared measurement unit
// to be a kilometre unit too — the Wialon UI is localised, so accept both the
// Latin and Cyrillic spellings.
const KM_UNITS = new Set(["km", "км", "kм"]);

function isKilometreSensor(sensor: { t?: unknown; m?: unknown }): boolean {
  if (sensor.t !== "mileage") return false;

  const unit = typeof sensor.m === "string" ? sensor.m.trim().toLowerCase() : "";

  return KM_UNITS.has(unit);
}

/**
 * Latest odometer reading per unit, for units that report one.
 *
 * Values come from unit/calc_last_message rather than the raw params on lmsg:
 * a message only carries the parameters that changed, so the odometer is absent
 * from most of them. Wialon resolves a sensor against the last *known* value,
 * which is what its own UI shows, and doing the same here avoids reimplementing
 * its formula evaluation.
 */
export async function getUnitOdometers(): Promise<{ readings: UnitOdometer[]; skipped: OdometerSkip[] }> {
  const sid = ((await call("token/login", { token: requireEnv("WIALON_TOKEN"), fl: 1 })).eid) as string;

  try {
    const search = await call(
      "core/search_items",
      {
        spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name", propType: "property", or_logic: 0 },
        force: 1,
        flags: 5121, // base info (0x1) + last position/message (0x400) + sensors (0x1000)
        from: 0,
        to: 0,
      },
      sid,
    );

    const units = (search.items ?? []) as Array<WialonUnit & { sens?: Record<string, { id?: number; n?: string; t?: string; m?: string }> }>;
    const readings: UnitOdometer[] = [];
    const skipped: OdometerSkip[] = [];

    for (const unit of units) {
      const sensors = Object.values(unit.sens ?? {});
      const mileage = sensors.filter(isKilometreSensor);

      if (mileage.length === 0) {
        const mistyped = sensors.some((s) => s.t === "mileage");
        skipped.push({
          unitName: unit.nm,
          reason: mistyped ? "sensor is not a distance" : "no mileage sensor",
        });
        continue;
      }

      const calculated = (await call("unit/calc_last_message", { unitId: unit.id, flags: 1 }, sid)) as Record<string, unknown>;

      // Highest plausible reading wins if a unit somehow defines more than one.
      let best: number | null = null;

      for (const sensor of mileage) {
        const value = calculated?.[String(sensor.id)];

        if (typeof value !== "number" || isNaReading(value) || !Number.isFinite(value) || value <= 0) {
          continue;
        }

        best = best === null ? value : Math.max(best, value);
      }

      if (best === null) {
        skipped.push({ unitName: unit.nm, reason: "no valid reading" });
        continue;
      }

      readings.push({
        unitId: unit.id,
        unitName: unit.nm,
        plateToken: unit.nm.split(/\s+/)[0] ?? "",
        km: Math.round(best),
      });
    }

    return { readings, skipped };
  } finally {
    await call("core/logout", {}, sid).catch(() => {});
  }
}

export { NA_VALUE };
