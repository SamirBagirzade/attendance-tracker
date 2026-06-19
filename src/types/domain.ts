export type Employee = {
  id: number;
  name: string;
  department: string;
};

export type Holiday = {
  id: number;
  date: string;
  description: string;
};

export type AttendanceStatus =
  | "ISDE"
  | "EZAMIYYET"
  | "MEZUNIYYET"
  | "XESTE"
  | "BAYRAM"
  | "ICAZELI"
  | "ISTIRAHET"
  | "ISDE_DEYIL"
  | "ISDE_XESARET";

export type Car = {
  id: number;
  makeModel: string;
  licensePlate: string;
  currentKm: number | null;
  oilChangeDate: string | null;
  oilChangeKm: number | null;
  oilBrand: string | null;
  oilQuantity: number | null;
  oilChangeIntervalKm: number | null;
  insuranceDate: string | null;
  insuranceCompany: string | null;
  insuranceCost: number | null;
  insuranceIntervalMonths: number | null;
  inspectionDate: string | null;
  inspectionIntervalMonths: number | null;
};

export type AttendanceRecord = {
  id: number;
  employeeId: number;
  date: string;
  status: AttendanceStatus;
  location: string | null;
  workLocations: Location[];
  cookedHeadcount: number | null;
  cookedPaid: boolean;
  carDriven: boolean;
  carId: number | null;
  car: Car | null;
  note: string | null;
};

export type Location = {
  id: number;
  name: string;
};

export type StatusColor = {
  status: AttendanceStatus;
  color: string;
  displayText: string;
};

export type ReportRow = {
  employeeId: number;
  employeeName: string;
  department: string;
  ezamiyyetDays: number;
  weekendWorkedDays: number;
  holidayWorkedDays: number;
  cookedHeadcountTotal: number;
  ezamiyyetByLocation: Record<string, number>;
};

export type ReportDetailRow = {
  id: number;
  date: string;
  status: AttendanceStatus;
  location: string | null;
  cookedHeadcount: number | null;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayDescription: string | null;
};

export type PersonReport = ReportRow & {
  records: ReportDetailRow[];
};

export type LocationReportDetailRow = {
  id: number;
  date: string;
  employeeId: number;
  employeeName: string;
  department: string;
  cookedHeadcount: number | null;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayDescription: string | null;
};

export type LocationReport = {
  location: string;
  ezamiyyetDays: number;
  uniqueDays: number;
  employeeCount: number;
  weekendWorkedDays: number;
  holidayWorkedDays: number;
  cookedHeadcountTotal: number;
  daysByEmployee: Record<string, number>;
  records: LocationReportDetailRow[];
};

export type FilteredReportRow = {
  id: number;
  date: string;
  employeeId: number;
  employeeName: string;
  department: string;
  status: AttendanceStatus;
  location: string | null;
  workLocations: string[];
  cookedHeadcount: number | null;
  cookedPaid: boolean;
  carDriven: boolean;
  car: string | null;
  note: string | null;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayDescription: string | null;
};

export type FilteredReport = {
  summary: {
    totalRecords: number;
    uniqueEmployees: number;
    statusCounts: Record<AttendanceStatus, number>;
    isdeDays: number;
    ezamiyyetDays: number;
    carsDrivenDays: number;
    weekendWorkedDays: number;
    holidayWorkedDays: number;
    cookedHeadcountTotal: number;
    uniqueLocations: number;
  };
  records: FilteredReportRow[];
};

export type CarMaintenanceType = "OIL_CHANGE" | "INSURANCE" | "INSPECTION";

export type CarMaintenanceRecord = {
  id: number;
  carId: number;
  car: { makeModel: string; licensePlate: string };
  type: CarMaintenanceType;
  date: string;
  km: number | null;
  oilBrand: string | null;
  oilQuantity: number | null;
  company: string | null;
  cost: number | null;
  notes: string | null;
  createdAt: string;
};

export type AuditLog = {
  id: number;
  username: string;
  role: string;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
};

export type AppUserRole = "EDITOR" | "VIEWER";

export type AppUser = {
  id: number;
  username: string;
  role: AppUserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
