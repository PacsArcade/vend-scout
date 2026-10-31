// RateFeed: sats per US dollar. v0 returns a fixed TEST rate. No price API is called.
// TODO: a real price feed (the house time service or an own-node source) behind this interface.
export interface Rate { satsPerUsd: number; test: boolean; label: string }
export interface RateFeed { name: string; rate(): Promise<Rate> }
export const stubRate: RateFeed = {
  name: "fixed test rate",
  async rate() { return { satsPerUsd: 1000, test: true, label: "TEST RATE" }; },
};
export const rateFeed: RateFeed = stubRate;
