import { NextRequest, NextResponse } from "next/server";
import { normalizeEmployeeInput } from "@/lib/employee";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const employees = await prisma.employee.findMany({
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(employees);
}

export async function POST(request: NextRequest) {
  try {
    const employee = await prisma.employee.create({
      data: normalizeEmployeeInput(await request.json()),
    });

    void logAudit(request, "CREATE", "Employee", employee.id, { name: employee.name, department: employee.department });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return handleEmployeeError(error);
  }
}

function handleEmployeeError(error: unknown) {
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected employee error." }, { status: 500 });
}
