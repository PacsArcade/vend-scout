// STARTING RATES, ruled by the Admiral at block 974,071 (from PAY-MODEL-RESEARCH.md sections 8 to 10).
// These are starting rates, not test values. They may be changed by the Admiral after real sales come in.
//
// MONEY RULE: public pages and crew pages show SATS ONLY, never a dollar sign. The dollar figures below stay internal.
// Only the operator money desk (the machine page margin card) may show dollars.
//
// DOLLARS TO SATS: there is no live price source in this repo (rate.ts is a fixed rate and no outside call is allowed here).
// So every dollar rate becomes a fixed number of sats at an ASSUMED bitcoin price (see SATS_PER_USD below).
// If the real price moves far from that, change SATS_PER_USD here (one place). Lightning fees count as 0 in all math (under a penny).
export const RATES_BLOCK = 974071;
export const RATES_LABEL = `starting rates, block ${RATES_BLOCK.toLocaleString("en-US")}`;
export const SATS_PER_USD = 1290; // ASSUMED: BTC at about $77,500 (mempool.space price at block 974,071)

export const RATES = {
  runnerPerStopUsd: 16, // Route Runner, batched route, paid in sats. The 1000 sat busy bonus stays in gig.ts
  scoutPlacedUsd: 50, // Place Scout, when the machine is placed
  scoutDay60Usd: 50, // Place Scout, at day 60 ...
  scoutDay60MinNetUsd: 800, // ... if the machine's net sales reach this per month
  hostPctStandard: 10, // Host cut, percent of net sales
  hostPctTopSpot: 12, // top spots, the operator picks per machine
  creditCapPct: 3, // a machine gives out at most this percent of its net sales per month in credits, at retail value
  creditItemUnits: 20, // 1 item = 20 credits, so a verify (10) is half an item and a share (5) is a quarter item
  creditVerifyItems: 0.5,
  creditShareItems: 0.25,
  productCostPct: 45, // of net sales
  cardFeePct: 5.95, // card fees per card sale
  cardMonthlyUsd: 7.95, // card reader monthly fee
  cardMixPct: 70, // ASSUMED share of sales paid by card (research section 8)
  salesTaxPct: 6, // ASSUMED, removed from gross to get net sales
  lightningFeeUsd: 0, // under a penny
  defaultItemSats: 2000, // ASSUMED retail price of one item when a machine has no sales yet ($2)
} as const;

export const HOST_PCTS: number[] = [RATES.hostPctStandard, RATES.hostPctTopSpot];
/** The operator picks 10 or 12. Anything else becomes the 10 percent default. */
export const cleanHostPct = (n: number) => (n === RATES.hostPctTopSpot ? RATES.hostPctTopSpot : RATES.hostPctStandard);

export const usdToSats = (usd: number) => Math.round(usd * SATS_PER_USD);
export const satsToUsd = (sats: number) => sats / SATS_PER_USD;

/** Credits for one verify or share, derived from the half and quarter item rule. */
export const CREDIT_VERIFY = RATES.creditVerifyItems * RATES.creditItemUnits; // 10
export const CREDIT_SHARE = RATES.creditShareItems * RATES.creditItemUnits; // 5

/** Net sales (sats) from gross sales (sats). */
export const netOf = (grossSats: number) => grossSats / (1 + RATES.salesTaxPct / 100);

/** Scout day-60 bonus: due when the machine has been placed 60 days or more and its net sales for the month reach $800. Sats, or 0. */
export function scoutDay60Sats(placedAtIso: string, monthlyNetSats: number, now = Date.now()): number {
  const placed = Date.parse(placedAtIso);
  if (!Number.isFinite(placed) || now - placed < 60 * 86400_000) return 0;
  return satsToUsd(monthlyNetSats) >= RATES.scoutDay60MinNetUsd ? usdToSats(RATES.scoutDay60Usd) : 0;
}

/** Credits a machine may give out in a month: 3% of net sales at retail value, in credits. Sales sats are in the same unit as the item price. */
export function creditCapCredits(monthlyNetSats: number, avgItemSats: number): number {
  const item = avgItemSats > 0 ? avgItemSats : RATES.defaultItemSats;
  return Math.floor(((monthlyNetSats * RATES.creditCapPct) / 100 / item) * RATES.creditItemUnits);
}

export interface Margin { grossUsd: number; netUsd: number; productUsd: number; hostUsd: number; cardUsd: number; crewUsd: number; creditsUsd: number; leftUsd: number }
/** The operator's monthly margin for one machine. Dollars, for the money desk only. */
export function margin(a: { grossSats: number; hostPct: number; crewSats: number; creditsGiven: number; avgItemSats: number }): Margin {
  const net = satsToUsd(netOf(a.grossSats));
  const productUsd = (net * RATES.productCostPct) / 100;
  const hostUsd = (net * a.hostPct) / 100;
  const cardUsd = ((net * RATES.cardMixPct) / 100) * (RATES.cardFeePct / 100) + RATES.cardMonthlyUsd; // lightning fees count as 0
  const crewUsd = satsToUsd(a.crewSats);
  const item = a.avgItemSats > 0 ? a.avgItemSats : RATES.defaultItemSats;
  const creditsUsd = satsToUsd((a.creditsGiven / RATES.creditItemUnits) * item);
  return { grossUsd: satsToUsd(a.grossSats), netUsd: net, productUsd, hostUsd, cardUsd, crewUsd, creditsUsd, leftUsd: net - productUsd - hostUsd - cardUsd - crewUsd - creditsUsd };
}

/** Dollar text for the operator money desk only. Kept here so no page file holds a dollar sign. */
export const fmtUsd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
