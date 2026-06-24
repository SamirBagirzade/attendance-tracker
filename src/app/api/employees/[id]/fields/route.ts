import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const fields = await prisma.customField.findMany({
    where: { employeeId: parseInt(id, 10) },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ fields });
}
