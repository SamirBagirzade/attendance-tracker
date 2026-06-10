import { AttendanceStatus } from "@prisma/client";
import { parseCalendarDate } from "@/lib/dates";

export type AttendanceRecordInput = {
  employeeId: number;
  date: string | Date;
  status: AttendanceStatus;
  location?: string | null;
  cookedHeadcount?: number | null;
};

export function normalizeAttendanceInput(input: AttendanceRecordInput) {
  const date = parseCalendarDate(input.date);
  const location = input.status === "EZAMIYYET" ? input.location?.trim() : null;
  const cookedHeadcount =
    input.status === "EZAMIYYET" && input.cookedHeadcount != null
      ? Number(input.cookedHeadcount)
      : null;

  if (!Number.isInteger(input.employeeId) || input.employeeId <= 0) {
    throw new Error("employeeId must be a positive integer.");
  }

  if (!Object.values(AttendanceStatus).includes(input.status)) {
    throw new Error("status is invalid.");
  }

  if (input.status === "EZAMIYYET" && !location) {
    throw new Error("location is required when status is EZAMIYYET.");
  }

  if (
    cookedHeadcount != null &&
    (!Number.isInteger(cookedHeadcount) || cookedHeadcount < 1)
  ) {
    throw new Error("cookedHeadcount must be a positive integer.");
  }

  return {
    employeeId: input.employeeId,
    date,
    status: input.status,
    location,
    cookedHeadcount,
  };
}
