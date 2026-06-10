import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";
import {
  defaultStatusColors,
  defaultStatusDisplayText,
  normalizeStatusColorInput,
} from "@/lib/status-colors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.statusColor.findMany();
  const settingsByStatus = new Map(settings.map((item) => [item.status, item]));

  return NextResponse.json(
    Object.values(AttendanceStatus).map((status) => {
      const setting = settingsByStatus.get(status);

      return {
        status,
        color: setting?.color ?? defaultStatusColors[status],
        displayText: setting?.displayText || defaultStatusDisplayText[status],
      };
    }),
  );
}

export async function PUT(request: NextRequest) {
  try {
    const input = normalizeStatusColorInput(await request.json());
    const statusColor = await prisma.statusColor.upsert({
      where: { status: input.status },
      create: input,
      update: {
        color: input.color,
        displayText: input.displayText,
      },
    });

    return NextResponse.json(statusColor);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unexpected status color error." }, { status: 500 });
  }
}
