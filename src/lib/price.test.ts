import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRICE_SOURCES, resetPriceMemo, satsPrice } from "./price";
import { SATS_PER_USD } from "./rates";

const ok = (usd: number) => new Response(JSON.stringify({ time: 1, USD: usd }));
beforeEach(() => { resetPriceMemo(); vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("price from our own node", () => {
  it("uses our node first", async () => {
    const f = vi.fn(async () => ok(77702)) as unknown as typeof fetch;
    const p = await satsPrice(f);
    expect(p.source).toBe("mempool.pacsarcade.org"); expect(p.satsPerUsd).toBe(Math.round(1e8 / 77702));
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(PRICE_SOURCES[0]);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
  it("falls back to mempool.space when our node fails", async () => {
    const f = vi.fn(async (u: string) => { if (u.includes("pacsarcade")) throw new Error("down"); return ok(80000); }) as unknown as typeof fetch;
    const p = await satsPrice(f);
    expect(p.source).toBe("mempool.space"); expect(p.satsPerUsd).toBe(1250);
  });
  it("falls back to the fixed figure when both fail, and logs it", async () => {
    const f = vi.fn(async () => new Response("no", { status: 502 })) as unknown as typeof fetch;
    const p = await satsPrice(f);
    expect(p.source).toBe("fixed"); expect(p.satsPerUsd).toBe(SATS_PER_USD);
    expect((console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.some((c) => String(c[0]).includes("[vend-price]"))).toBe(true);
  });
  it("rejects a nonsense price and caches for ten minutes", async () => {
    const f = vi.fn(async (u: string) => (u.includes("pacsarcade") ? ok(3) : ok(100000))) as unknown as typeof fetch;
    const t = Date.now();
    expect((await satsPrice(f, t)).satsPerUsd).toBe(1000);
    const calls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    await satsPrice(f, t + 9 * 60_000); expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
    await satsPrice(f, t + 11 * 60_000); expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(calls);
  });
  it("gives each source a 3 second timeout", () => { expect(readFileSync("src/lib/price.ts", "utf8")).toContain("AbortSignal.timeout(TIMEOUT_MS)"); expect(readFileSync("src/lib/price.ts", "utf8")).toContain("TIMEOUT_MS = 3000"); });
});
