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
};

export type AttendanceRecord = {
  id: number;
  employeeId: number;
  date: string;
  status: AttendanceStatus;
  location: string | null;
  workLocations: Location[];
  cookedHeadcount: number | null;
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

export type AppUserRole = "EDITOR" | "VIEWER";

export type AppUser = {
  id: number;
  username: string;
  role: AppUserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
