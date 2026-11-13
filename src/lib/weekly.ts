import { BLOCKS_PER_YEAR } from "./bft";

export const BLOCKS_PER_WEEK = 1008;
export interface Week { week: number; count: number; now: boolean }
/** Sales per block-week for the last n weeks that end at the newest sale (or at the height given). Weeks count from the start of the block year. Sales with no block height are skipped. */
export function salesPerWeek(sales: { h?: number; test?: boolean }[], n = 8, nowH?: number): Week[] {
  const hs = sales.filter((s) => typeof s.h === "number" && !s.test).map((s) => s.h as number);
  if (hs.length === 0) return [];
  const end = Math.floor((nowH ?? Math.max(...hs)) / BLOCKS_PER_WEEK);
  const out: Week[] = [];
  for (let w = end - n + 1; w <= end; w++) out.push({ week: (((w * BLOCKS_PER_WEEK) % BLOCKS_PER_YEAR) / BLOCKS_PER_WEEK) + 1, count: hs.filter((h) => Math.floor(h / BLOCKS_PER_WEEK) === w).length, now: w === end });
  return out;
}
