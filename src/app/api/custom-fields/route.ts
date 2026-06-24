import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const value = String(body.value ?? "").trim();
  const carId = body.carId ? parseInt(body.carId, 10) : null;
  const employeeId = body.employeeId ? parseInt(body.employeeId, 10) : null;

  if (!name) return Response.json({ error: "name required." }, { status: 400 });
  if (!value) return Response.json({ error: "value required." }, { status: 400 });
  if (!carId && !employeeId) return Response.json({ error: "carId or employeeId required." }, { status: 400 });

  const field = await prisma.customField.create({ data: { name, value, carId, employeeId } });
  return Response.json({ field });
}
