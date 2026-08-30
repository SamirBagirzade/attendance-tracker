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

  let body: Partial<Prices>;

  try {
    body = (await request.json()) as Partial<Prices>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Math.max(0, NaN) is NaN, and JSON.stringify writes NaN as null — a single
  // non-numeric tier used to persist as null and turn every catering total into
  // null downstream. Reject the value instead of storing it.
  const tierKeys = ["tier1", "tier2", "tier3", "tier4", "tier5plus"] as const;
  const prices = { ...DEFAULT_PRICES };

  for (const key of tierKeys) {
    const raw = body[key];

    if (raw == null || raw === ("" as unknown)) {
      continue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { error: `${key} must be a number of zero or more.` },
        { status: 400 },
      );
    }

    prices[key] = value;
  }

  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(prices) },
    update: { value: JSON.stringify(prices) },
  });

  return NextResponse.json(prices);
}
