import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PRICES, type Prices } from "@/lib/ai/catering";

const SETTING_KEY = "cook_prices";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return NextResponse.json(DEFAULT_PRICES);

  try {
    return NextResponse.json(JSON.parse(row.value) as Prices);
  } catch {
    return NextResponse.json(DEFAULT_PRICES);
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json() as Partial<Prices>;

  const prices: Prices = {
    tier1: Math.max(0, Number(body.tier1 ?? DEFAULT_PRICES.tier1)),
    tier2: Math.max(0, Number(body.tier2 ?? DEFAULT_PRICES.tier2)),
    tier3: Math.max(0, Number(body.tier3 ?? DEFAULT_PRICES.tier3)),
    tier4: Math.max(0, Number(body.tier4 ?? DEFAULT_PRICES.tier4)),
    tier5plus: Math.max(0, Number(body.tier5plus ?? DEFAULT_PRICES.tier5plus)),
  };

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(prices) },
    update: { value: JSON.stringify(prices) },
  });

  return NextResponse.json(prices);
}
