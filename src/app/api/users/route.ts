import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/passwords";
import { requireAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  normalizeIsActive,
  normalizeManagedRole,
  normalizePassword,
  normalizeUsername,
} from "@/lib/users";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);

  if (denied) {
    return denied;
  }

  const users = await prisma.appUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })),
  );
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);

  if (denied) {
    return denied;
  }

  try {
    const body = await request.json();
    const user = await prisma.appUser.create({
      data: {
        username: normalizeUsername(body.username),
        passwordHash: await hashPassword(normalizePassword(body.password)),
        role: normalizeManagedRole(body.role),
        isActive: normalizeIsActive(body.isActive),
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    void logAudit(request, "CREATE", "User", user.id, { username: user.username, role: user.role });
    return NextResponse.json(
      {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleUserError(error);
  }
}

export function handleUserError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected user error." }, { status: 500 });
}
