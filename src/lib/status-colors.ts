import type { AttendanceStatus } from "@prisma/client";

export const defaultStatusColors: Record<AttendanceStatus, string> = {
  ISDE: "#dcfce7",
  EZAMIYYET: "#dbeafe",
  MEZUNIYYET: "#fef3c7",
  XESTE: "#fee2e2",
  BAYRAM: "#fed7aa",
  ICAZELI: "#e9d5ff",
  ISTIRAHET: "#cffafe",
  ISDE_DEYIL: "#e5e7eb",
};

export const defaultStatusDisplayText: Record<AttendanceStatus, string> = {
  ISDE: "İ",
  EZAMIYYET: "E",
  MEZUNIYYET: "M",
  XESTE: "X",
  BAYRAM: "B",
  ICAZELI: "İc",
  ISTIRAHET: "İs",
  ISDE_DEYIL: "D",
};

export function normalizeStatusColorInput(input: {
  status?: unknown;
  color?: unknown;
  displayText?: unknown;
}) {
  const status = String(input.status ?? "") as AttendanceStatus;
  const color = typeof input.color === "string" ? input.color.trim() : "";
  const displayText =
    typeof input.displayText === "string" ? input.displayText.trim() : "";

  if (!(status in defaultStatusColors)) {
    throw new Error("status is invalid.");
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error("color must be a valid hex color.");
  }

  if (!displayText) {
    throw new Error("displayText is required.");
  }

  if (displayText.length > 24) {
    throw new Error("displayText must be 24 characters or fewer.");
  }

  return { status, color, displayText };
}
