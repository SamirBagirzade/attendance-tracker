import { NextRequest, NextResponse } from "next/server";
import { authCookieName, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(authCookieName)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const session = await verifySessionToken(token);
    return NextResponse.json({
      authenticated: true,
      username: session.username,
      role: session.role,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
