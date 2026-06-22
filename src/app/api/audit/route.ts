import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username") ?? undefined;
  const entity = searchParams.get("entity") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: {
    username?: string;
    entity?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (username) where.username = username;
  if (entity) where.entity = entity;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }

  const page = Math.max(0, Number(searchParams.get("page") ?? 0));
  const pageSize = 100;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    logs: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
  });
}
