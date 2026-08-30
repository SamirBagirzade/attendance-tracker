import { format } from "date-fns";

// Normalize to noon UTC so @db.Date truncation never shifts the calendar day,
// regardless of server timezone (startOfDay in local TZ east of UTC moved
// UTC-midnight dates back one day).
function utcNoon(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

export function parseCalendarDate(value: string | Date, fieldName = "date") {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} must be a valid date.`);
    }

    return utcNoon(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return utcNoon(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return utcNoon(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function parseDateParam(value: string, fieldName: string) {
  return parseCalendarDate(value, fieldName);
}

// Calendar day (YYYY-MM-DD) of a real timestamp in Baku local time, independent
// of the server process's TZ env — for turning a submission moment (e.g. a
// Google Form response) into "which attendance day does this belong to".
export function bakuDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(date);
}

// Attendance records older than this (in Baku calendar days) can only be
// edited by ADMIN/SUPERVISOR — everyone else is locked out of retroactive edits.
export const RECORD_EDIT_LOCK_DAYS = 5;

export function isDateEditLocked(date: Date): boolean {
  const today = parseCalendarDate(bakuDateKey(new Date()));
  // Normalise the incoming date too. A date written through parseCalendarDate is
  // noon UTC, but the same value read back out of a @db.Date column is midnight
  // UTC — comparing the two raw gave N + 0.5 days, which Math.round lifted to
  // N + 1 and locked records a day early on the by-id routes only.
  const target = parseCalendarDate(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  return diffDays > RECORD_EDIT_LOCK_DAYS;
}

export function toDateKey(date: Date | string) {
  return format(new Date(date), "yyyy-MM-dd");
}

export function toApiDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dateRangeWhere(from?: string | null, to?: string | null) {
  const where: {
    gte?: Date;
    lte?: Date;
  } = {};

  if (from) {
    where.gte = parseDateParam(from, "from");
  }

  if (to) {
    where.lte = parseDateParam(to, "to");
  }

  return where;
}
