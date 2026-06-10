import { parseCalendarDate } from "@/lib/dates";

export type HolidayInput = {
  date?: unknown;
  description?: unknown;
};

export function normalizeHolidayInput(input: HolidayInput) {
  const date = parseCalendarDate(String(input.date ?? ""));
  const description =
    typeof input.description === "string" ? input.description.trim() : "";

  if (!description) {
    throw new Error("description is required.");
  }

  return {
    date,
    description,
  };
}
