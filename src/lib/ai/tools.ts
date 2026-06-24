import type Anthropic from "@anthropic-ai/sdk";

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_attendance_summary",
    description:
      "Query attendance records for a date range. Returns summary counts by status and individual records (capped at 100). Use for questions about who worked, absences, trip counts, car usage, weekend/holiday work, etc.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        employeeId: { type: "number", description: "Filter to one employee (optional)" },
        department: { type: "string", description: "Filter by department name (optional)" },
        status: {
          type: "string",
          enum: [
            "ISDE",
            "EZAMIYYET",
            "MEZUNIYYET",
            "XESTE",
            "BAYRAM",
            "ICAZELI",
            "ISTIRAHET",
            "ISDE_DEYIL",
            "ISDE_XESARET",
          ],
          description: "Filter by attendance status (optional)",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_employees",
    description:
      "List all employees with their department, vacation limit (days/year), and sick day limit (days/year). Use when the user asks about the workforce composition or needs employee IDs for follow-up queries.",
    input_schema: {
      type: "object",
      properties: {
        department: { type: "string", description: "Filter by department (optional)" },
      },
      required: [],
    },
  },
  {
    name: "get_dashboard",
    description:
      "Today's snapshot: total employees, how many have no record today, status breakdown for today, and car maintenance alerts (overdue/warning).",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_employee_absences",
    description:
      "For a given year, return each employee's sick days used (XESTE), vacation days used (MEZUNIYYET), and permitted leave used (ICAZELI), compared to their annual limits. Use for questions about leave balances or limit breaches.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Calendar year, e.g. 2025" },
        employeeId: { type: "number", description: "Limit to one employee (optional)" },
      },
      required: ["year"],
    },
  },
  {
    name: "get_cook_report",
    description:
      "Catering/cook report for a date range. Returns each cook session with date, headcount, computed cost (tiered pricing), and paid status — grouped by employee with totals. Use for questions about catering costs, cook sessions, or unpaid catering.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        employeeId: { type: "number", description: "Filter to one employee (optional)" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_car_status",
    description:
      "Returns all fleet cars with their current km, maintenance dates, and computed severity flags (ok/warning/overdue) for oil change, insurance, and inspection. Use for questions about car maintenance or fleet health.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_fuel_transactions",
    description:
      "Query cached Azpetrol fuel card transactions (Card Sale type only). Returns individual fill-ups with date, plate, car, product (fuel type), quantity in litres, cost in AZN, and station. Use for questions about fuel spending, fuel consumption, which cars or drivers refuelled, cost by station, etc.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        plate: { type: "string", description: "Filter by licence plate (optional) — normalized uppercase, no dashes e.g. 90YG862" },
        carId: { type: "number", description: "Filter by car ID (optional)" },
        stationName: { type: "string", description: "Filter by station name partial match (optional)" },
      },
      required: ["from", "to"],
    },
  },
];
