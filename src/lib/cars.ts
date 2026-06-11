export function normalizeCarInput(input: {
  makeModel?: unknown;
  licensePlate?: unknown;
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

  return { makeModel, licensePlate };
}
