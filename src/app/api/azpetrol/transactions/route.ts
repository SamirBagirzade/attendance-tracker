import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { findTransactions } from "@/lib/azpetrol-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const result = await findTransactions(body);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
