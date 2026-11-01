// RateFeed: sats per US dollar. Returns the fixed starting figure from rates.ts (assumed BTC price stated there). No price API is called.
// TODO: a real price feed (the house time service or an own-node source) behind this interface.
export interface Rate { satsPerUsd: number; test: boolean; label: string }
export interface RateFeed { name: string; rate(): Promise<Rate> }
import { RATES_LABEL, SATS_PER_USD } from "./rates";
export const stubRate: RateFeed = {
  name: "fixed starting rate",
  async rate() { return { satsPerUsd: SATS_PER_USD, test: false, label: RATES_LABEL }; },
};
export const rateFeed: RateFeed = stubRate;
