export type Prices = {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  tier5plus: number;
};

export const DEFAULT_PRICES: Prices = {
  tier1: 10,
  tier2: 20,
  tier3: 25,
  tier4: 30,
  tier5plus: 35,
};

export function cateringCostForHeadcount(headcount: number, prices: Prices = DEFAULT_PRICES): number {
  if (headcount <= 0) return 0;
  if (headcount === 1) return prices.tier1;
  if (headcount === 2) return prices.tier2;
  if (headcount === 3) return prices.tier3;
  if (headcount === 4) return prices.tier4;
  return prices.tier5plus;
}
