import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const value = String(body.value ?? "").trim();
  if (!value) return Response.json({ error: "value required." }, { status: 400 });

  const field = await prisma.customField.update({ where: { id: parseInt(id, 10) }, data: { value } });
  return Response.json({ field });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  await prisma.customField.delete({ where: { id: parseInt(id, 10) } });
  return new Response(null, { status: 204 });
}
