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
  | "ISDE_DEYIL";

export type AttendanceRecord = {
  id: number;
  employeeId: number;
  date: string;
  status: AttendanceStatus;
  location: string | null;
  workLocations: Location[];
  cookedHeadcount: number | null;
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
  isWeekend: boolean;
  isHoliday: boolean;
  holidayDescription: string | null;
};

export type FilteredReport = {
  summary: {
    totalRecords: number;
    uniqueEmployees: number;
    isdeDays: number;
    ezamiyyetDays: number;
    weekendWorkedDays: number;
    holidayWorkedDays: number;
    cookedHeadcountTotal: number;
    uniqueLocations: number;
  };
  records: FilteredReportRow[];
};
