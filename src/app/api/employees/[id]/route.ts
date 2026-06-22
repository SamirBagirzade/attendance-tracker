import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { normalizeEmployeeInput } from "@/lib/employee";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id } });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return NextResponse.json(employee);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data: normalizeEmployeeInput(await request.json()),
    });

    void logAudit(request, "UPDATE", "Employee", id, { name: employee.name, department: employee.department });
    return NextResponse.json(employee);
  } catch (error) {
    return handleEmployeeError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = Number((await context.params).id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id must be a positive integer." }, { status: 400 });
  }

  try {
    await prisma.employee.delete({ where: { id } });
    void logAudit(request, "DELETE", "Employee", id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleEmployeeError(error);
  }
}

function handleEmployeeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected employee error." }, { status: 500 });
}
