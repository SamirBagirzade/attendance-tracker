export type EmployeeInput = {
  name?: unknown;
  department?: unknown;
  vacationLimit?: unknown;
  sickLimit?: unknown;
  isTemporary?: unknown;
};

type EmployeeFields = {
  name: string;
  department: string;
  vacationLimit: number | null;
  sickLimit: number | null;
  isTemporary: boolean;
};

function parseRequiredString(value: unknown, field: string): string {
  const s = typeof value === "string" ? value.trim() : "";

  if (!s) {
    throw new Error(`${field} is required.`);
  }

  return s;
}

function parseOptionalLimit(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }

  return n;
}

const employeeFieldParsers: {
  [K in keyof EmployeeFields]: (value: unknown) => EmployeeFields[K];
} = {
  name: (v) => parseRequiredString(v, "name"),
  department: (v) => parseRequiredString(v, "department"),
  vacationLimit: (v) => parseOptionalLimit(v, "vacationLimit"),
  sickLimit: (v) => parseOptionalLimit(v, "sickLimit"),
  isTemporary: (v) => v === true || v === "true",
};

const employeeFieldNames = Object.keys(employeeFieldParsers) as Array<keyof EmployeeFields>;

export function normalizeEmployeeInput(input: EmployeeInput): EmployeeFields {
  const result = {} as EmployeeFields;

  for (const name of employeeFieldNames) {
    Object.assign(result, { [name]: employeeFieldParsers[name](input[name]) });
  }

  return result;
}

// Only the keys present in the body are written. Omitting vacationLimit used to
// null it out, so a partial PATCH silently discarded leave allowances.
export function normalizeEmployeePatch(input: EmployeeInput): Partial<EmployeeFields> {
  const result: Partial<EmployeeFields> = {};

  for (const name of employeeFieldNames) {
    if (Object.hasOwn(input, name)) {
      Object.assign(result, { [name]: employeeFieldParsers[name](input[name]) });
    }
  }

  if (Object.keys(result).length === 0) {
    throw new Error("No fields to update.");
  }

  return result;
}
