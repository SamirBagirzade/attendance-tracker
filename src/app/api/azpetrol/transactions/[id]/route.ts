import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { getTransactionById } from "@/lib/azpetrol-client";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const result = await getTransactionById(id);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
