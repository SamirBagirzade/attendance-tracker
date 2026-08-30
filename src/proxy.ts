import { NextRequest, NextResponse } from "next/server";
import { authCookieName, verifySessionToken } from "@/lib/auth";

// Listed here only because each of these authenticates itself: the two sync
// endpoints accept a cron secret or fall back to requireAdmin, and the daily-log
// webhook checks FORMS_WEBHOOK_SECRET. Without this the proxy answers 401 before
// the handler's own check ever runs.
const publicPaths = [
  "/login",
  "/api/auth/login",
  "/api/azpetrol/sync",
  "/api/telemetry/odometer-sync",
  "/api/forms/daily-log",
];

function isPublicPath(pathname: string) {
  return (
    publicPaths.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(authCookieName)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    const session = await verifySessionToken(token);

    if (isAdminOnlyPath(pathname) && session.role !== "ADMIN") {
      return denyRequest(request);
    }

    if (isViewerBlockedRequest(request) && session.role === "VIEWER") {
      return denyRequest(request);
    }

    return NextResponse.next();
  } catch {
    return redirectToLogin(request);
  }
}

function isAdminOnlyPath(pathname: string) {
  return (
    pathname === "/users" ||
    pathname === "/audit" ||
    pathname === "/form-submissions" ||
    // Both directions of /backup are ADMIN-only: the export carries every
    // AppUser password hash, and the restore replaces the whole database.
    pathname === "/backup" ||
    pathname.startsWith("/api/backups") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/audit") ||
    (pathname.startsWith("/api/forms/daily-log/") && pathname !== "/api/forms/daily-log/summary")
  );
}

function isViewerBlockedRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/auth/")) {
    return false;
  }

  return !["GET", "HEAD", "OPTIONS"].includes(request.method);
}

function denyRequest(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const timesheetUrl = request.nextUrl.clone();
  timesheetUrl.pathname = "/timesheet";
  timesheetUrl.search = "";
  return NextResponse.redirect(timesheetUrl);
}

function redirectToLogin(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
