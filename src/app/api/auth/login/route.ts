import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authCookieName, createSessionToken, getAdminCredentials } from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { checkDurableLimit, clearDurableLimit, clientKey } from "@/lib/rate-limit";

// Compare via fixed-length digests so the check is constant-time regardless of
// how much of the credential the caller guessed, and works for unequal lengths.
function secretEquals(a: string, b: string) {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();

  return timingSafeEqual(digestA, digestB);
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { username: rawUsername, password: rawPassword } = (body ?? {}) as {
    username?: unknown;
    password?: unknown;
  };
  const username = typeof rawUsername === "string" ? rawUsername : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  // Two limits with different jobs. The per-address one is the real brake on
  // brute force; the per-username one is deliberately looser, because a strict
  // one would let anybody lock a colleague out by guessing at their name.
  const addressKey = `login:ip:${clientKey(request)}`;
  const usernameKey = `login:user:${username.toLowerCase()}`;

  const [byAddress, byUsername] = await Promise.all([
    checkDurableLimit(addressKey, 20, 15 * 60 * 1000),
    checkDurableLimit(usernameKey, 10, 15 * 60 * 1000),
  ]);

  if (!byAddress.allowed || !byUsername.allowed) {
    const retryAfter = Math.max(byAddress.retryAfterSeconds, byUsername.retryAfterSeconds);

    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let admin: { username: string; password: string };

  try {
    admin = getAdminCredentials();
  } catch (error) {
    console.error("[login] Admin credentials are not configured:", error);
    return NextResponse.json({ error: "Server is not configured for login." }, { status: 500 });
  }

  let user = null;

  if (secretEquals(username, admin.username) && secretEquals(password, admin.password)) {
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

  // Successful sign-in clears the counters, so a run of typos doesn't keep
  // counting against someone who then got it right.
  await Promise.all([clearDurableLimit(addressKey), clearDurableLimit(usernameKey)]);

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
