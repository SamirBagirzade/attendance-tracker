import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getFuelReport } from "@/lib/wialon-client";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const carId = parseInt(id, 10);
  if (isNaN(carId)) return Response.json({ error: "Invalid car id." }, { status: 400 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return Response.json({ error: "from and to are required (YYYY-MM-DD)." }, { status: 400 });

  const car = await prisma.car.findUnique({ where: { id: carId }, select: { licensePlate: true } });
  if (!car) return Response.json({ error: "Car not found." }, { status: 404 });

  // Wialon reports its interval in the account's own timezone, so a UTC-anchored
  // window put every day boundary four hours out and pushed trips near midnight
  // into the neighbouring day. Azerbaijan is a fixed UTC+4 with no DST.
  const fromDate = new Date(from + "T00:00:00+04:00");
  const toDate = new Date(to + "T23:59:59+04:00");

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return Response.json({ error: "from and to must be valid dates (YYYY-MM-DD)." }, { status: 400 });
  }

  const fromUnix = Math.floor(fromDate.getTime() / 1000);
  const toUnix = Math.floor(toDate.getTime() / 1000);

  try {
    const report = await getFuelReport(car.licensePlate, fromUnix, toUnix);
    return Response.json(report);
  } catch (err) {
    return Response.json({ error: String(err instanceof Error ? err.message : err) }, { status: 502 });
  }
}
