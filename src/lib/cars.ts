import { parseCalendarDate } from "@/lib/dates";

// These throw rather than returning null on bad input. Returning null meant a
// typo in a date or a km reading silently erased the stored value and answered
// 200 OK — the caller had no way to tell a cleared field from a rejected one.
//
// An absent key, null, or "" all mean "clear this field"; anything unparseable
// is an error.
function parseOptionalInt(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${field} must be a number of zero or more.`);
  }

  return Math.round(n);
}

function parseOptionalFloat(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${field} must be a number of zero or more.`);
  }

  return n;
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value !== "string") {
    throw new Error(`${field} must be a date string.`);
  }

  // parseCalendarDate, not new Date: these are @db.Date columns and every other
  // calendar date in the codebase is normalised to noon UTC.
  return parseCalendarDate(value, field);
}

function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const s = String(value).trim();

  return s === "" ? null : s;
}

function parseRequiredString(value: unknown, field: string): string {
  const s = typeof value === "string" ? value.trim() : "";

  if (!s) {
    throw new Error(`${field} is required.`);
  }

  return s;
}

export type CarInput = {
  makeModel?: unknown;
  licensePlate?: unknown;
  currentKm?: unknown;
  oilChangeDate?: unknown;
  oilChangeKm?: unknown;
  oilBrand?: unknown;
  oilQuantity?: unknown;
  oilChangeIntervalKm?: unknown;
  insuranceDate?: unknown;
  insuranceCompany?: unknown;
  insuranceCost?: unknown;
  insuranceIntervalMonths?: unknown;
  inspectionDate?: unknown;
  inspectionIntervalMonths?: unknown;
  fuelCardNumber?: unknown;
  fuelOnly?: unknown;
};

type CarFields = {
  makeModel: string;
  licensePlate: string;
  currentKm: number | null;
  oilChangeDate: Date | null;
  oilChangeKm: number | null;
  oilBrand: string | null;
  oilQuantity: number | null;
  oilChangeIntervalKm: number | null;
  insuranceDate: Date | null;
  insuranceCompany: string | null;
  insuranceCost: number | null;
  insuranceIntervalMonths: number | null;
  inspectionDate: Date | null;
  inspectionIntervalMonths: number | null;
  fuelCardNumber: string | null;
  fuelOnly: boolean;
};

// One parser per field, shared by the create and patch paths so the two can
// never drift apart in what they accept.
const carFieldParsers: {
  [K in keyof CarFields]: (value: unknown) => CarFields[K];
} = {
  makeModel: (v) => parseRequiredString(v, "makeModel"),
  licensePlate: (v) => parseRequiredString(v, "licensePlate").toUpperCase(),
  currentKm: (v) => parseOptionalInt(v, "currentKm"),
  oilChangeDate: (v) => parseOptionalDate(v, "oilChangeDate"),
  oilChangeKm: (v) => parseOptionalInt(v, "oilChangeKm"),
  oilBrand: (v) => parseOptionalString(v),
  oilQuantity: (v) => parseOptionalFloat(v, "oilQuantity"),
  oilChangeIntervalKm: (v) => parseOptionalInt(v, "oilChangeIntervalKm"),
  insuranceDate: (v) => parseOptionalDate(v, "insuranceDate"),
  insuranceCompany: (v) => parseOptionalString(v),
  insuranceCost: (v) => parseOptionalFloat(v, "insuranceCost"),
  insuranceIntervalMonths: (v) => parseOptionalInt(v, "insuranceIntervalMonths"),
  inspectionDate: (v) => parseOptionalDate(v, "inspectionDate"),
  inspectionIntervalMonths: (v) => parseOptionalInt(v, "inspectionIntervalMonths"),
  fuelCardNumber: (v) => parseOptionalString(v),
  fuelOnly: (v) => v === true || v === "true",
};

const carFieldNames = Object.keys(carFieldParsers) as Array<keyof CarFields>;

// Create: every field is written, and the two required ones must be present.
export function normalizeCarInput(input: CarInput): CarFields {
  const result = {} as CarFields;

  for (const name of carFieldNames) {
    Object.assign(result, { [name]: carFieldParsers[name](input[name]) });
  }

  return result;
}

// Patch: only the keys actually present in the body are touched. Sending
// {"oilBrand": null} clears it; omitting oilBrand leaves it alone. Previously
// every omitted key was written as null, so a partial PATCH wiped the record.
export function normalizeCarPatch(input: CarInput): Partial<CarFields> {
  const result: Partial<CarFields> = {};

  for (const name of carFieldNames) {
    if (Object.hasOwn(input, name)) {
      Object.assign(result, { [name]: carFieldParsers[name](input[name]) });
    }
  }

  if (Object.keys(result).length === 0) {
    throw new Error("No fields to update.");
  }

  return result;
}

export function formatCarDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}
