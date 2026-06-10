export type EmployeeInput = {
  name?: unknown;
  department?: unknown;
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

  return {
    name,
    department,
  };
}
