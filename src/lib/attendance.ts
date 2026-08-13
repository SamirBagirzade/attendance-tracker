import { AttendanceStatus, PaymentType } from "@prisma/client";
import { parseCalendarDate } from "@/lib/dates";

export type AttendanceRecordInput = {
  employeeId: number;
  date: string | Date;
  status: AttendanceStatus;
  location?: string | null;
  workLocationIds?: unknown;
  newWorkLocationNames?: unknown;
  cookedHeadcount?: number | null;
  cookedPaid?: unknown;
  carDriven?: unknown;
  carId?: unknown;
  note?: unknown;
  paymentType?: unknown;
  paymentAmount?: unknown;
  paymentPaid?: unknown;
};

const carAllowedStatuses = new Set<AttendanceStatus>([
  "ISDE",
  "EZAMIYYET",
  "MEZUNIYYET",
  "BAYRAM",
  "ISDE_XESARET",
]);

export function normalizeAttendanceInput(input: AttendanceRecordInput) {
  const date = parseCalendarDate(input.date);
  const location = input.status === "EZAMIYYET" ? input.location?.trim() : null;
  const cookedHeadcount =
    input.status === "EZAMIYYET" && input.cookedHeadcount != null
      ? Number(input.cookedHeadcount)
      : null;
  const cookedPaid = cookedHeadcount != null ? input.cookedPaid === true : false;
  const workLocationIds =
    Array.isArray(input.workLocationIds) && input.status === "ISDE"
      ? input.workLocationIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  const carDriven = carAllowedStatuses.has(input.status) && input.carDriven === true;
  const carId = carDriven ? Number(input.carId) : null;
  const note = typeof input.note === "string" ? input.note.trim() : null;
  const paymentType =
    typeof input.paymentType === "string" &&
    Object.values(PaymentType).includes(input.paymentType as PaymentType)
      ? (input.paymentType as PaymentType)
      : null;
  const paymentAmount =
    paymentType != null && input.paymentAmount != null && input.paymentAmount !== ""
      ? Number(input.paymentAmount)
      : null;
  const paymentPaid =
    paymentType != null
      ? input.paymentPaid != null && input.paymentPaid !== ""
        ? Number(input.paymentPaid)
        : 0
      : null;
  const newWorkLocationNames =
    Array.isArray(input.newWorkLocationNames) && input.status === "ISDE"
      ? input.newWorkLocationNames
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.trim())
          .filter(Boolean)
      : [];

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

  if (carDriven && (carId == null || !Number.isInteger(carId) || carId <= 0)) {
    throw new Error("car is required when car was driven.");
  }

  if (note && note.length > 1000) {
    throw new Error("note must be 1000 characters or fewer.");
  }

  if (paymentType != null && (paymentAmount == null || !Number.isFinite(paymentAmount) || paymentAmount <= 0)) {
    throw new Error("paymentAmount must be a positive number when paymentType is set.");
  }

  if (
    paymentType != null &&
    (paymentPaid == null ||
      !Number.isFinite(paymentPaid) ||
      paymentPaid < 0 ||
      (paymentAmount != null && paymentPaid > paymentAmount))
  ) {
    throw new Error("paymentPaid must be between 0 and paymentAmount.");
  }

  return {
    employeeId: input.employeeId,
    date,
    status: input.status,
    location,
    workLocationIds,
    newWorkLocationNames,
    cookedHeadcount,
    cookedPaid,
    carDriven,
    carId,
    note,
    paymentType,
    paymentAmount,
    paymentPaid,
  };
}
