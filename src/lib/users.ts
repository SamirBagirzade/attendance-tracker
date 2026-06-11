import { UserRole } from "@prisma/client";

export function normalizeUsername(value: unknown) {
  const username = typeof value === "string" ? value.trim() : "";

  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new Error("Username must be 3-40 characters and use letters, numbers, dot, dash, or underscore.");
  }

  return username;
}

export function normalizePassword(value: unknown) {
  const password = typeof value === "string" ? value : "";

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  return password;
}

export function normalizeManagedRole(value: unknown) {
  const role = typeof value === "string" ? value : "";

  if (role !== UserRole.EDITOR && role !== UserRole.VIEWER) {
    throw new Error("Role must be EDITOR or VIEWER.");
  }

  return role;
}

export function normalizeIsActive(value: unknown) {
  return typeof value === "boolean" ? value : true;
}
