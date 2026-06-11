import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/passwords";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeManagedRole, normalizePassword } from "@/lib/users";
import { handleUserError } from "../route";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = await requireAdmin(request);

  if (denied) {
    return denied;
  }

  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data: Prisma.AppUserUpdateInput = {};

    if (body.role != null) {
      data.role = normalizeManagedRole(body.role);
    }

    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    if (body.password != null && body.password !== "") {
      data.passwordHash = await hashPassword(normalizePassword(body.password));
    }

    const user = await prisma.appUser.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleUserError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = await requireAdmin(request);

  if (denied) {
    return denied;
  }

  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.appUser.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return handleUserError(error);
  }

  return new NextResponse(null, { status: 204 });
}
