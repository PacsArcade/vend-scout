import { SATS_PER_USD } from "./rates";
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { CREDIT_SHARE, CREDIT_VERIFY, RATES, RATES_BLOCK, cleanHostPct, creditCapCredits, margin, netOf, scoutDay60Sats, usdToSats } from "./rates";
import { satsFor } from "./crew";
import { CREDITS, GIG } from "./gig";
import { creditsFull, grantCreditsResult, monthSales } from "./store";
import type { State } from "./store";

const base = (): State => ({ tracked: {}, notes: {}, packages: {}, outreach: {}, hostPicks: {}, online: {}, passes: {}, seen: {}, blocks: [], payouts: [], proofs: [], items: [], aiLog: [], checks: {}, scoutAwards: [], credits: {}, creditLog: [], verifies: [], reports: [], itemRequests: [], dms: [], machines: [], sales: [], orders: [], listings: [], ballots: {}, suggestions: {}, applicants: [], routes: [], claims: [], counter: 0 });
const now = new Date().toISOString();
const sale = (sats: number) => ({ machine: "m1", slot: "A1", item: "x", sats, at: now, test: false });

describe("starting rates, block 974,071", () => {
  it("holds the ruled values", () => {
    expect(RATES_BLOCK).toBe(974071);
    expect(RATES.runnerPerStopUsd).toBe(16); expect(RATES.scoutDealUsd).toBe(25); expect(RATES.scoutPlacedUsd).toBe(25); expect(RATES.scoutDay60Usd).toBe(50); expect(RATES.scoutDay60MinNetUsd).toBe(800);
    expect([RATES.hostPctStandard, RATES.hostPctTopSpot]).toEqual([10, 12]); expect(RATES.creditCapPct).toBe(3);
    expect(RATES.cardFeePct).toBe(5.95); expect(RATES.cardMonthlyUsd).toBe(7.95); expect(RATES.productCostPct).toBe(45); expect(RATES.lightningFeeUsd).toBe(0);
    expect(GIG.busyBonusSats).toBe(1000);
    expect(satsFor("restock", 1000)).toBe(16000); expect(satsFor("scout", 1000)).toBe(0); // a scout is paid in parts, see scoutpay.ts
  });
  it("host cut is 10 or 12 only", () => { expect(cleanHostPct(12)).toBe(12); expect(cleanHostPct(10)).toBe(10); expect(cleanHostPct(33)).toBe(10); expect(cleanHostPct(NaN)).toBe(10); });
  it("has no Whisper number anywhere in the rates", () => { expect(readFileSync("src/lib/rates.ts", "utf8")).not.toMatch(/whisper/i); });
});

describe("scout day 60 rule", () => {
  const day = 86400_000, placed = "2026-01-01T00:00:00Z", t0 = Date.parse(placed);
  const net800 = usdToSats(800), net799 = usdToSats(799);
  it("pays $50 after day 60 when net sales reach $800 a month", () => { expect(scoutDay60Sats(placed, net800, t0 + 60 * day)).toBe(50 * SATS_PER_USD); });
  it("pays nothing before day 60 or under $800", () => {
    expect(scoutDay60Sats(placed, net800, t0 + 59 * day)).toBe(0);
    expect(scoutDay60Sats(placed, net799, t0 + 90 * day)).toBe(0);
    expect(scoutDay60Sats("", net800, t0 + 90 * day)).toBe(0);
  });
});

describe("credits: half and quarter item, 3% cap", () => {
  it("a verify is half an item and a share a quarter (20 credits an item)", () => { expect(CREDIT_VERIFY).toBe(10); expect(CREDIT_SHARE).toBe(5); expect(CREDITS.verify).toBe(10); expect(CREDITS.share).toBe(5); });
  it("the cap is 3% of net sales at retail value", () => {
    // net 100,000 sats, items 2,000 sats: 3% = 3,000 sats = 1.5 items = 30 credits
    expect(creditCapCredits(100_000, 2000)).toBe(30);
    expect(creditCapCredits(0, 2000)).toBe(0);
  });
  it("stops giving credits at the cap, still says so, and keeps the once-a-day rule", () => {
    const st = base();
    const gross = Math.round(100_000 * 1.06); // net 100,000 sats, one 2,000 sat average item below
    for (let i = 0; i < 53; i++) st.sales.push(sale(2000)); // 106,000 sats gross
    expect(monthSales(st, "m1").gross).toBe(106_000); expect(gross).toBe(106_000); expect(netOf(106_000)).toBeCloseTo(100_000, 0);
    const npubs = ["a", "b", "c", "d"].map((c) => c.repeat(64));
    expect(grantCreditsResult(st, npubs[0], "verify", "m1", 10)).toBe("given"); // 10
    expect(grantCreditsResult(st, npubs[0], "verify", "m1", 10)).toBe("today");
    expect(grantCreditsResult(st, npubs[1], "verify", "m1", 10)).toBe("given"); // 20
    expect(grantCreditsResult(st, npubs[2], "verify", "m1", 10)).toBe("given"); // 30 = the cap
    expect(creditsFull(st, "m1", 5)).toBe(true);
    expect(grantCreditsResult(st, npubs[3], "share", "m1", 5)).toBe("full");
    expect(st.credits[npubs[3]]).toBeUndefined();
  });
  it("a new machine with no sales gets 100 credits (5 items) in its first month, then it is full", () => {
    const st = base(); st.machines.push({ id: "mN", addedAt: now.slice(0, 10), placedAt: "" } as never);
    let given = 0;
    for (let i = 0; i < 12; i++) if (grantCreditsResult(st, String(i).padStart(64, "a"), "verify", "mN", 10) === "given") given += 10;
    expect(given).toBe(100);
    expect(grantCreditsResult(st, "f".repeat(64), "verify", "mN", 10)).toBe("full");
  });
  it("an old machine with no sales has no allowance", () => {
    const st = base(); st.machines.push({ id: "mO", addedAt: "2024-01-01", placedAt: "2024-01-01" } as never);
    expect(grantCreditsResult(st, "1".repeat(64), "verify", "mO", 10)).toBe("full");
  });
});

describe("margin card math", () => {
  it("works the monthly P&L (research section 8, average site)", () => {
    const m = margin({ grossSats: usdToSats(597.84), hostPct: 10, crewSats: usdToSats(32), creditsGiven: 0, avgItemSats: 2000 });
    expect(m.netUsd).toBeCloseTo(564, 0); expect(m.productUsd).toBeCloseTo(253.8, 0); expect(m.hostUsd).toBeCloseTo(56.4, 0);
    expect(m.cardUsd).toBeCloseTo(0.7 * 564 * 0.0595 + 7.95, 1);
    expect(m.leftUsd).toBeCloseTo(m.netUsd - m.productUsd - m.hostUsd - m.cardUsd - 32, 1);
  });
});

describe("no dollar signs on public and crew pages", () => {
  const files = (d: string, out: string[] = []) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) files(p, out); else if (/\.tsx?$/.test(p) && !/test\.ts$/.test(p)) out.push(p); } return out; };
  it("crew pages, public pages and the crew copy hold no dollar figure", () => {
    const pages = files("src/app").filter((p) => !p.includes(`${path.sep}machines${path.sep}`) && !p.includes(`${path.sep}admin${path.sep}`) && !p.includes(`${path.sep}api${path.sep}`));
    const bad = pages.filter((p) => /\$\d|\$ ?\{?\s*[A-Z]/.test(readFileSync(p, "utf8").replace(/\$\{/g, "")));
    expect(bad).toEqual([]);
    for (const f of ["src/lib/crew.ts", "src/lib/jobs.ts"]) expect(readFileSync(f, "utf8").replace(/\/\/.*$/gm, "")).not.toMatch(/\$\d/);
  });
  it("the margin card is the only place that formats dollars, and it is on the operator machine page", () => {
    const users = files("src").filter((p) => /fmtUsd/.test(readFileSync(p, "utf8")) && !p.endsWith("rates.ts") && !p.endsWith("rates.test.ts"));
    expect(users).toEqual([path.join("src", "app", "machines", "[id]", "page.tsx")]);
  });
});
