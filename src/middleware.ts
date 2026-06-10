import { NextRequest, NextResponse } from "next/server";
import { authCookieName, verifySessionToken } from "@/lib/auth";

const publicPaths = ["/login", "/api/auth/login"];

function isPublicPath(pathname: string) {
  return (
    publicPaths.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(authCookieName)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    await verifySessionToken(token);
    return NextResponse.next();
  } catch {
    return redirectToLogin(request);
  }
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
