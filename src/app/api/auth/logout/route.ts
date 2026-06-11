import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth";

export async function POST() {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login",
    },
  });
  response.cookies.delete(authCookieName);
  return response;
}
