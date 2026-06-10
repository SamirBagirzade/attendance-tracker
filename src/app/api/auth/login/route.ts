import { NextRequest, NextResponse } from "next/server";
import { authCookieName, createSessionToken, getAdminCredentials } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const admin = getAdminCredentials();

  if (username !== admin.username || password !== admin.password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const response = NextResponse.json({ ok: true });

  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}
