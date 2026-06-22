import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function logAudit(
  request: NextRequest,
  action: string,
  entity: string,
  entityId?: number | null,
  details?: unknown,
): Promise<void> {
  try {
    const user = await getSessionUser(request);
    if (!user) return;

    await prisma.auditLog.create({
      data: {
        username: user.username,
        role: user.role,
        action,
        entity,
        entityId: entityId ?? null,
        details: details != null ? JSON.stringify(details) : null,
      },
    });
  } catch {
    // fire-and-forget: never fail the caller
  }
}
