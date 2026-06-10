export type LocationInput = {
  name?: unknown;
};

export function normalizeLocationInput(input: LocationInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!name) {
    throw new Error("name is required.");
  }

  return { name };
}
