import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus, UserRole } from "@prisma/client";
import { requireAdmin, requireEditor } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const backupVersion = 1;

type BackupPayload = {
  version: typeof backupVersion;
  app: "attendance-tracker";
  exportedAt: string;
  data: BackupData;
};

type BackupData = {
  appUsers: AppUserBackup[];
  employees: EmployeeBackup[];
  holidays: HolidayBackup[];
  locations: LocationBackup[];
  cars: CarBackup[];
  statusColors: StatusColorBackup[];
  attendanceRecords: AttendanceRecordBackup[];
  attendanceWorkLocations: AttendanceWorkLocationBackup[];
};

type AppUserBackup = {
  id: number;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EmployeeBackup = {
  id: number;
  name: string;
  department: string;
  createdAt: string;
  updatedAt: string;
};

type HolidayBackup = {
  id: number;
  date: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type LocationBackup = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type CarBackup = {
  id: number;
  makeModel: string;
  licensePlate: string;
  createdAt: string;
  updatedAt: string;
};

type StatusColorBackup = {
  id: number;
  status: AttendanceStatus;
  color: string;
  displayText: string;
  createdAt: string;
  updatedAt: string;
};

type AttendanceRecordBackup = {
  id: number;
  employeeId: number;
  date: string;
  status: AttendanceStatus;
  location: string | null;
  cookedHeadcount: number | null;
  carDriven: boolean;
  carId: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type AttendanceWorkLocationBackup = {
  id: number;
  attendanceRecordId: number;
  locationId: number;
};

const sequenceTables = [
  "AppUser",
  "Employee",
  "Holiday",
  "Location",
  "Car",
  "StatusColor",
  "AttendanceRecord",
  "AttendanceWorkLocation",
] as const;

export async function GET(request: NextRequest) {
  const denied = await requireEditor(request);

  if (denied) {
    return denied;
  }

  const exportedAt = new Date().toISOString();
  const payload: BackupPayload = {
    version: backupVersion,
    app: "attendance-tracker",
    exportedAt,
    data: await readBackupData(),
  };

  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="attendance-tracker-backup-${exportedAt.slice(0, 10)}.json"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);

  if (denied) {
    return denied;
  }

  try {
    const body = await request.json();

    if (!isRecord(body) || body.confirmRestore !== "RESTORE") {
      return NextResponse.json({ error: "Restore confirmation is required." }, { status: 400 });
    }

    const backup = normalizeBackup(body.backup);
    await restoreBackup(backup.data);

    void logAudit(request, "RESTORE", "Backup", null, { exportedAt: backup.exportedAt });
    return NextResponse.json({
      ok: true,
      restoredAt: new Date().toISOString(),
      counts: countBackupRows(backup.data),
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unexpected restore error." }, { status: 500 });
  }
}

async function readBackupData(): Promise<BackupData> {
  const [
    appUsers,
    employees,
    holidays,
    locations,
    cars,
    statusColors,
    attendanceRecords,
    attendanceWorkLocations,
  ] = await Promise.all([
    prisma.appUser.findMany({ orderBy: { id: "asc" } }),
    prisma.employee.findMany({ orderBy: { id: "asc" } }),
    prisma.holiday.findMany({ orderBy: { id: "asc" } }),
    prisma.location.findMany({ orderBy: { id: "asc" } }),
    prisma.car.findMany({ orderBy: { id: "asc" } }),
    prisma.statusColor.findMany({ orderBy: { id: "asc" } }),
    prisma.attendanceRecord.findMany({ orderBy: { id: "asc" } }),
    prisma.attendanceWorkLocation.findMany({ orderBy: { id: "asc" } }),
  ]);

  return {
    appUsers: appUsers.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    employees: employees.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    holidays: holidays.map((item) => ({
      ...item,
      date: toDateOnly(item.date),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    locations: locations.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    cars: cars.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    statusColors: statusColors.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    attendanceRecords: attendanceRecords.map((item) => ({
      ...item,
      date: toDateOnly(item.date),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    attendanceWorkLocations,
  };
}

async function restoreBackup(data: BackupData) {
  await prisma.$transaction(
    async (tx) => {
      await tx.attendanceWorkLocation.deleteMany();
      await tx.attendanceRecord.deleteMany();
      await tx.statusColor.deleteMany();
      await tx.holiday.deleteMany();
      await tx.location.deleteMany();
      await tx.car.deleteMany();
      await tx.employee.deleteMany();
      await tx.appUser.deleteMany();

      if (data.appUsers.length > 0) {
        await tx.appUser.createMany({
          data: data.appUsers.map((item) => ({
            ...item,
            createdAt: parseDate(item.createdAt, "appUsers.createdAt"),
            updatedAt: parseDate(item.updatedAt, "appUsers.updatedAt"),
          })),
        });
      }

      if (data.employees.length > 0) {
        await tx.employee.createMany({
          data: data.employees.map((item) => ({
            ...item,
            createdAt: parseDate(item.createdAt, "employees.createdAt"),
            updatedAt: parseDate(item.updatedAt, "employees.updatedAt"),
          })),
        });
      }

      if (data.holidays.length > 0) {
        await tx.holiday.createMany({
          data: data.holidays.map((item) => ({
            ...item,
            date: parseDate(item.date, "holidays.date"),
            createdAt: parseDate(item.createdAt, "holidays.createdAt"),
            updatedAt: parseDate(item.updatedAt, "holidays.updatedAt"),
          })),
        });
      }

      if (data.locations.length > 0) {
        await tx.location.createMany({
          data: data.locations.map((item) => ({
            ...item,
            createdAt: parseDate(item.createdAt, "locations.createdAt"),
            updatedAt: parseDate(item.updatedAt, "locations.updatedAt"),
          })),
        });
      }

      if (data.cars.length > 0) {
        await tx.car.createMany({
          data: data.cars.map((item) => ({
            ...item,
            createdAt: parseDate(item.createdAt, "cars.createdAt"),
            updatedAt: parseDate(item.updatedAt, "cars.updatedAt"),
          })),
        });
      }

      if (data.statusColors.length > 0) {
        await tx.statusColor.createMany({
          data: data.statusColors.map((item) => ({
            ...item,
            createdAt: parseDate(item.createdAt, "statusColors.createdAt"),
            updatedAt: parseDate(item.updatedAt, "statusColors.updatedAt"),
          })),
        });
      }

      if (data.attendanceRecords.length > 0) {
        await tx.attendanceRecord.createMany({
          data: data.attendanceRecords.map((item) => ({
            ...item,
            date: parseDate(item.date, "attendanceRecords.date"),
            createdAt: parseDate(item.createdAt, "attendanceRecords.createdAt"),
            updatedAt: parseDate(item.updatedAt, "attendanceRecords.updatedAt"),
          })),
        });
      }

      if (data.attendanceWorkLocations.length > 0) {
        await tx.attendanceWorkLocation.createMany({ data: data.attendanceWorkLocations });
      }

      for (const table of sequenceTables) {
        await tx.$queryRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX("id") FROM "${table}"), 1), (SELECT MAX("id") FROM "${table}") IS NOT NULL)`,
        );
      }
    },
    { timeout: 60_000 },
  );
}

function normalizeBackup(value: unknown): BackupPayload {
  if (!isRecord(value)) {
    throw new Error("Backup file must contain a JSON object.");
  }

  if (value.version !== backupVersion || value.app !== "attendance-tracker") {
    throw new Error("Backup file is not compatible with this app version.");
  }

  if (typeof value.exportedAt !== "string") {
    throw new Error("Backup file is missing exportedAt.");
  }

  const data = value.data;

  if (!isRecord(data)) {
    throw new Error("Backup file is missing data.");
  }

  return {
    version: backupVersion,
    app: "attendance-tracker",
    exportedAt: value.exportedAt,
    data: {
      appUsers: readArray(data, "appUsers").map(normalizeAppUser),
      employees: readArray(data, "employees").map(normalizeEmployee),
      holidays: readArray(data, "holidays").map(normalizeHoliday),
      locations: readArray(data, "locations").map(normalizeLocation),
      cars: readArray(data, "cars").map(normalizeCar),
      statusColors: readArray(data, "statusColors").map(normalizeStatusColor),
      attendanceRecords: readArray(data, "attendanceRecords").map(normalizeAttendanceRecord),
      attendanceWorkLocations: readArray(data, "attendanceWorkLocations").map(
        normalizeAttendanceWorkLocation,
      ),
    },
  };
}

function normalizeAppUser(value: unknown): AppUserBackup {
  const item = requireRecord(value, "appUsers");

  return {
    id: readPositiveInteger(item, "appUsers.id"),
    username: readString(item, "appUsers.username"),
    passwordHash: readString(item, "appUsers.passwordHash"),
    role: readUserRole(item.role),
    isActive: readBoolean(item, "appUsers.isActive"),
    createdAt: readDateString(item, "appUsers.createdAt"),
    updatedAt: readDateString(item, "appUsers.updatedAt"),
  };
}

function normalizeEmployee(value: unknown): EmployeeBackup {
  const item = requireRecord(value, "employees");

  return {
    id: readPositiveInteger(item, "employees.id"),
    name: readString(item, "employees.name"),
    department: readString(item, "employees.department"),
    createdAt: readDateString(item, "employees.createdAt"),
    updatedAt: readDateString(item, "employees.updatedAt"),
  };
}

function normalizeHoliday(value: unknown): HolidayBackup {
  const item = requireRecord(value, "holidays");

  return {
    id: readPositiveInteger(item, "holidays.id"),
    date: readDateString(item, "holidays.date"),
    description: readString(item, "holidays.description"),
    createdAt: readDateString(item, "holidays.createdAt"),
    updatedAt: readDateString(item, "holidays.updatedAt"),
  };
}

function normalizeLocation(value: unknown): LocationBackup {
  const item = requireRecord(value, "locations");

  return {
    id: readPositiveInteger(item, "locations.id"),
    name: readString(item, "locations.name"),
    createdAt: readDateString(item, "locations.createdAt"),
    updatedAt: readDateString(item, "locations.updatedAt"),
  };
}

function normalizeCar(value: unknown): CarBackup {
  const item = requireRecord(value, "cars");

  return {
    id: readPositiveInteger(item, "cars.id"),
    makeModel: readString(item, "cars.makeModel"),
    licensePlate: readString(item, "cars.licensePlate"),
    createdAt: readDateString(item, "cars.createdAt"),
    updatedAt: readDateString(item, "cars.updatedAt"),
  };
}

function normalizeStatusColor(value: unknown): StatusColorBackup {
  const item = requireRecord(value, "statusColors");

  return {
    id: readPositiveInteger(item, "statusColors.id"),
    status: readAttendanceStatus(item.status),
    color: readString(item, "statusColors.color"),
    displayText: readString(item, "statusColors.displayText"),
    createdAt: readDateString(item, "statusColors.createdAt"),
    updatedAt: readDateString(item, "statusColors.updatedAt"),
  };
}

function normalizeAttendanceRecord(value: unknown): AttendanceRecordBackup {
  const item = requireRecord(value, "attendanceRecords");

  return {
    id: readPositiveInteger(item, "attendanceRecords.id"),
    employeeId: readPositiveInteger(item, "attendanceRecords.employeeId"),
    date: readDateString(item, "attendanceRecords.date"),
    status: readAttendanceStatus(item.status),
    location: readNullableString(item, "attendanceRecords.location"),
    cookedHeadcount: readNullablePositiveInteger(item, "attendanceRecords.cookedHeadcount"),
    carDriven: readBoolean(item, "attendanceRecords.carDriven"),
    carId: readNullablePositiveInteger(item, "attendanceRecords.carId"),
    note: readNullableString(item, "attendanceRecords.note"),
    createdAt: readDateString(item, "attendanceRecords.createdAt"),
    updatedAt: readDateString(item, "attendanceRecords.updatedAt"),
  };
}

function normalizeAttendanceWorkLocation(value: unknown): AttendanceWorkLocationBackup {
  const item = requireRecord(value, "attendanceWorkLocations");

  return {
    id: readPositiveInteger(item, "attendanceWorkLocations.id"),
    attendanceRecordId: readPositiveInteger(
      item,
      "attendanceWorkLocations.attendanceRecordId",
    ),
    locationId: readPositiveInteger(item, "attendanceWorkLocations.locationId"),
  };
}

function countBackupRows(data: BackupData) {
  return {
    appUsers: data.appUsers.length,
    employees: data.employees.length,
    holidays: data.holidays.length,
    locations: data.locations.length,
    cars: data.cars.length,
    statusColors: data.statusColors.length,
    attendanceRecords: data.attendanceRecords.length,
    attendanceWorkLocations: data.attendanceWorkLocations.length,
  };
}

function readArray(record: Record<string, unknown>, key: keyof BackupData) {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`Backup data.${key} must be an array.`);
  }

  return value;
}

function requireRecord(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`Backup ${label} item must be an object.`);
  }

  return value;
}

function readPositiveInteger(record: Record<string, unknown>, label: string) {
  const key = label.split(".").at(-1) ?? label;
  const value = record[key];

  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Backup ${label} must be a positive integer.`);
  }

  return Number(value);
}

function readNullablePositiveInteger(record: Record<string, unknown>, label: string) {
  const key = label.split(".").at(-1) ?? label;
  const value = record[key];

  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Backup ${label} must be a positive integer or null.`);
  }

  return Number(value);
}

function readString(record: Record<string, unknown>, label: string) {
  const key = label.split(".").at(-1) ?? label;
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`Backup ${label} must be a string.`);
  }

  return value;
}

function readNullableString(record: Record<string, unknown>, label: string) {
  const key = label.split(".").at(-1) ?? label;
  const value = record[key];

  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Backup ${label} must be a string or null.`);
  }

  return value;
}

function readBoolean(record: Record<string, unknown>, label: string) {
  const key = label.split(".").at(-1) ?? label;
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error(`Backup ${label} must be a boolean.`);
  }

  return value;
}

function readDateString(record: Record<string, unknown>, label: string) {
  const value = readString(record, label);
  parseDate(value, label);
  return value;
}

function readAttendanceStatus(value: unknown) {
  if (typeof value !== "string" || !Object.values(AttendanceStatus).includes(value as AttendanceStatus)) {
    throw new Error("Backup status is invalid.");
  }

  return value as AttendanceStatus;
}

function readUserRole(value: unknown) {
  if (typeof value !== "string" || !Object.values(UserRole).includes(value as UserRole)) {
    throw new Error("Backup user role is invalid.");
  }

  return value as UserRole;
}

function parseDate(value: string, label: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Backup ${label} must be a valid date.`);
  }

  return date;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
