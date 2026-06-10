import { NextRequest, NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.delete(authCookieName);
  return response;
}
