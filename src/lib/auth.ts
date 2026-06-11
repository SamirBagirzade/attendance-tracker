import { jwtVerify, SignJWT } from "jose";

export const authCookieName = "attendance_auth";
export const userRoles = ["ADMIN", "EDITOR", "VIEWER"] as const;

export type UserRole = (typeof userRoles)[number];
export type SessionUser = {
  username: string;
  role: UserRole;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(username: string, role: UserRole) {
  return new SignJWT({ username, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getAuthSecret());
  const username = typeof payload.username === "string" ? payload.username : "";
  const role = typeof payload.role === "string" && isUserRole(payload.role) ? payload.role : null;

  if (!username || !role) {
    throw new Error("Invalid session.");
  }

  return { username, role };
}

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME ?? "admin",
    password: process.env.ADMIN_PASSWORD ?? "admin",
  };
}

export function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole);
}
