import { NextRequest, NextResponse } from "next/server";
import { authCookieName, createSessionToken, getAdminCredentials } from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const admin = getAdminCredentials();
  let user = null;

  if (username === admin.username && password === admin.password) {
    user = { username, role: "ADMIN" as const };
  } else {
    const appUser = await prisma.appUser.findUnique({
      where: { username },
    });

    if (appUser?.isActive && (await verifyPassword(password, appUser.passwordHash))) {
      user = { username: appUser.username, role: appUser.role };
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await createSessionToken(user.username, user.role);
  const response = NextResponse.json({ ok: true, username: user.username, role: user.role });
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isSecureRequest =
    forwardedProto === "https" || request.nextUrl.protocol === "https:";

  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest,
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}
