import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.carMaintenanceRecord.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  void logAudit(request, "DELETE", "MaintenanceRecord", id);
  return new NextResponse(null, { status: 204 });
}
