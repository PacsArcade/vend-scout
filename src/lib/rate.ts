// RateFeed: sats per US dollar, read from our own node (price.ts) with fallbacks. Never blocks: timeout plus the fixed figure in rates.ts.
export interface Rate { satsPerUsd: number; test: boolean; label: string }
export interface RateFeed { name: string; rate(): Promise<Rate> }
import { RATES_LABEL } from "./rates";
import { satsPrice } from "./price";
export const stubRate: RateFeed = {
  name: "own node price, fixed fallback",
  async rate() { const p = await satsPrice(); return { satsPerUsd: p.satsPerUsd, test: false, label: RATES_LABEL }; },
};
export const rateFeed: RateFeed = stubRate;
