import { AttendanceStatus, ExpenseType, PaymentType } from "@prisma/client";
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
  workerName?: unknown;
  paymentType?: unknown;
  paymentAmount?: unknown;
  paymentPaid?: unknown;
  expenseType?: unknown;
  expenseAmount?: unknown;
  fineAmount?: unknown;
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
  const workerName = typeof input.workerName === "string" ? input.workerName.trim() || null : null;
  const paymentType =
    typeof input.paymentType === "string" &&
    Object.values(PaymentType).includes(input.paymentType as PaymentType)
      ? (input.paymentType as PaymentType)
      : null;
  const paymentAmount =
    paymentType != null
      ? input.paymentAmount != null && input.paymentAmount !== ""
        ? Number(input.paymentAmount)
        : 0
      : null;
  const paymentPaid =
    paymentType != null
      ? input.paymentPaid != null && input.paymentPaid !== ""
        ? Number(input.paymentPaid)
        : 0
      : null;
  const expenseType =
    typeof input.expenseType === "string" &&
    Object.values(ExpenseType).includes(input.expenseType as ExpenseType)
      ? (input.expenseType as ExpenseType)
      : null;
  const expenseAmount =
    expenseType != null && input.expenseAmount != null && input.expenseAmount !== ""
      ? Number(input.expenseAmount)
      : null;
  const fineAmount =
    input.fineAmount != null && input.fineAmount !== "" ? Number(input.fineAmount) : null;
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

  if (workerName && workerName.length > 200) {
    throw new Error("workerName must be 200 characters or fewer.");
  }

  if (paymentType != null && (paymentAmount == null || !Number.isFinite(paymentAmount) || paymentAmount < 0)) {
    throw new Error("paymentAmount must be zero or a positive number when paymentType is set.");
  }

  // paymentPaid is not capped by this record's paymentAmount — payments accumulate
  // across an interval (e.g. calculate 40/day for 5 days, then one entry of
  // calculated=0, paid=200 to settle the running total).
  if (paymentType != null && (paymentPaid == null || !Number.isFinite(paymentPaid) || paymentPaid < 0)) {
    throw new Error("paymentPaid must be zero or a positive number.");
  }

  if (paymentType != null && paymentAmount === 0 && paymentPaid === 0) {
    throw new Error("Enter a calculated amount or a paid amount.");
  }

  if (expenseType != null && (expenseAmount == null || !Number.isFinite(expenseAmount) || expenseAmount <= 0)) {
    throw new Error("expenseAmount must be a positive number when expenseType is set.");
  }

  if (fineAmount != null && (!Number.isFinite(fineAmount) || fineAmount <= 0)) {
    throw new Error("fineAmount must be a positive number.");
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
    workerName,
    paymentType,
    paymentAmount,
    paymentPaid,
    expenseType,
    expenseAmount,
    fineAmount,
  };
}
