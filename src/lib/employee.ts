export type EmployeeInput = {
  name?: unknown;
  department?: unknown;
  vacationLimit?: unknown;
  sickLimit?: unknown;
};

export function normalizeEmployeeInput(input: EmployeeInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const department = typeof input.department === "string" ? input.department.trim() : "";

  if (!name) {
    throw new Error("name is required.");
  }

  if (!department) {
    throw new Error("department is required.");
  }

  const vacationLimit =
    input.vacationLimit != null && input.vacationLimit !== ""
      ? Number(input.vacationLimit)
      : null;
  const sickLimit =
    input.sickLimit != null && input.sickLimit !== ""
      ? Number(input.sickLimit)
      : null;

  if (vacationLimit !== null && (!Number.isInteger(vacationLimit) || vacationLimit < 0)) {
    throw new Error("vacationLimit must be a non-negative integer.");
  }

  if (sickLimit !== null && (!Number.isInteger(sickLimit) || sickLimit < 0)) {
    throw new Error("sickLimit must be a non-negative integer.");
  }

  return {
    name,
    department,
    vacationLimit,
    sickLimit,
  };
}
