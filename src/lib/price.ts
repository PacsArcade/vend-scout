// BTC/USD for turning dollar rates into sats. Our own node first, then mempool.space, then the fixed figure in rates.ts.
// A NEW LIVE DEPENDENCY, so it can never block a page: 3 second timeout per source, 10 minute cache, and a fallback every time.
import { SATS_PER_USD } from "./rates";

export const PRICE_SOURCES = ["https://mempool.pacsarcade.org/api/v1/prices", "https://mempool.space/api/v1/prices"] as const;
const TIMEOUT_MS = 3000;
const TTL_MS = 10 * 60_000;

export interface SatsPrice { satsPerUsd: number; btcUsd: number | null; source: string; at: number }
let memo: SatsPrice | null = null;
let pending: Promise<SatsPrice> | null = null;
export const resetPriceMemo = () => { memo = null; pending = null; };

async function fromSource(url: string, f: typeof fetch): Promise<number | null> {
  try {
    const res = await f(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
    if (!res.ok) { console.error(`[vend-price] ${new URL(url).host} answered ${res.status}`); return null; }
    const usd = Number(((await res.json()) as { USD?: unknown }).USD);
    if (!Number.isFinite(usd) || usd < 1000 || usd > 10_000_000) { console.error(`[vend-price] ${new URL(url).host} gave an unusable price`); return null; }
    return usd;
  } catch (e) {
    console.error(`[vend-price] ${new URL(url).host} failed: ${String((e as Error)?.name ?? "error")}`);
    return null;
  }
}

/** Sats per US dollar right now. Never throws, never waits longer than about 6 seconds, cached for 10 minutes. */
export function satsPrice(f: typeof fetch = fetch, now = Date.now()): Promise<SatsPrice> {
  // VEND_PRICE=off (tests, offline dev) skips the network for the default fetch and uses the fixed figure.
  if (process.env.VEND_PRICE === "off" && f === globalThis.fetch) return Promise.resolve({ satsPerUsd: SATS_PER_USD, btcUsd: null, source: "fixed", at: now });
  if (memo && now - memo.at < TTL_MS) return Promise.resolve(memo);
  if (pending) return pending;
  pending = (async () => {
    for (const url of PRICE_SOURCES) {
      const usd = await fromSource(url, f);
      if (usd) return (memo = { satsPerUsd: Math.round(1e8 / usd), btcUsd: usd, source: new URL(url).host, at: now });
    }
    console.error(`[vend-price] no price source answered, using the fixed ${SATS_PER_USD} sats per dollar`);
    // Remember the fallback for a minute only, so a recovered node is picked up soon.
    return (memo = { satsPerUsd: SATS_PER_USD, btcUsd: null, source: "fixed", at: now - (TTL_MS - 60_000) });
  })().finally(() => { pending = null; });
  return pending;
}
