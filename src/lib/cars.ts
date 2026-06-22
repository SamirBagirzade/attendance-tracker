function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function parseOptionalFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export function normalizeCarInput(input: {
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
}) {
  const makeModel = typeof input.makeModel === "string" ? input.makeModel.trim() : "";
  const licensePlate =
    typeof input.licensePlate === "string" ? input.licensePlate.trim().toUpperCase() : "";

  if (!makeModel) {
    throw new Error("makeModel is required.");
  }

  if (!licensePlate) {
    throw new Error("licensePlate is required.");
  }

  return {
    makeModel,
    licensePlate,
    currentKm: parseOptionalInt(input.currentKm),
    oilChangeDate: parseOptionalDate(input.oilChangeDate),
    oilChangeKm: parseOptionalInt(input.oilChangeKm),
    oilBrand: parseOptionalString(input.oilBrand),
    oilQuantity: parseOptionalFloat(input.oilQuantity),
    oilChangeIntervalKm: parseOptionalInt(input.oilChangeIntervalKm),
    insuranceDate: parseOptionalDate(input.insuranceDate),
    insuranceCompany: parseOptionalString(input.insuranceCompany),
    insuranceCost: parseOptionalFloat(input.insuranceCost),
    insuranceIntervalMonths: parseOptionalInt(input.insuranceIntervalMonths),
    inspectionDate: parseOptionalDate(input.inspectionDate),
    inspectionIntervalMonths: parseOptionalInt(input.inspectionIntervalMonths),
  };
}

export function formatCarDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}
