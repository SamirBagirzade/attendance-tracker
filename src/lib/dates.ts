import { format, startOfDay } from "date-fns";

export function parseCalendarDate(value: string | Date, fieldName = "date") {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} must be a valid date.`);
    }

    return startOfDay(value);
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return startOfDay(date);
}

export function parseDateParam(value: string, fieldName: string) {
  return parseCalendarDate(value, fieldName);
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
