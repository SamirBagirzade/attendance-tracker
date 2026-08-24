import { NextRequest, NextResponse } from "next/server";
import { authCookieName, verifySessionToken, type SessionUser } from "@/lib/auth";
import { isDateEditLocked } from "@/lib/dates";

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(authCookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireEditor(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return null;
}

export async function requireAdmin(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return null;
}

// Records older than RECORD_EDIT_LOCK_DAYS can only be touched by ADMIN/SUPERVISOR.
export async function requireDateEditable(request: NextRequest, date: Date) {
  if (!isDateEditLocked(date)) {
    return null;
  }

  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (user.role !== "ADMIN" && user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { error: "This date is more than 5 days old and can only be edited by an admin or supervisor." },
      { status: 403 },
    );
  }

  return null;
}
