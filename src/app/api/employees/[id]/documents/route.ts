import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const documents = await prisma.document.findMany({
    where: { employeeId: parseInt(id, 10) },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, name: true, filename: true, mimetype: true, size: true, uploadedAt: true },
  });

  return Response.json({ documents });
}
