import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs, mkdtempSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { SATS_PER_USD, usdToSats } from "./rates";

const NOW = Date.now(), DAY = 86400_000;
const iso = (ago: number) => new Date(NOW - ago * DAY).toISOString();
const seed = (over: Record<string, unknown> = {}) => ({
  machines: [{ id: "m1", name: "M1", status: "Placed", type: "snack", prospectId: "osm-n1", hostName: "Host", hostSharePct: 10, placedAt: iso(70).slice(0, 10), profile: {}, slots: [] }],
  applicants: [{ id: "a1", name: "Maya Reyes", reach: "m@x.co", area: "Chicago", roles: ["scout"], transport: [], hours: "", why: "", stage: "On the crew", lightning: "maya@wallet.example", notes: [], createdAt: "2026-01-01" }],
  claims: [{ job: "scout:osm-n1", kind: "scout", title: "Pitch Host", sats: 0, by: "a1", at: iso(80) }],
  tracked: { "osm-n1": "Placed" },
  sales: [],
  ...over,
});

describe("public search and loading never reach Overpass", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.doUnmock("./blobstore"); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("copyOnly scan of a place no copy covers returns notLoaded and makes no network call", async () => {
    const stored = new Map<string, string>();
    vi.doMock("./blobstore", async (orig) => ({ ...(await orig<typeof import("./blobstore")>()), readText: async (r: string) => stored.get(r) ?? null, writeText: async (r: string, t: string) => { stored.set(r, t); }, storageMissing: () => false }));
    vi.stubEnv("VEND_OSM_DIR", mkdtempSync(path.join(os.tmpdir(), "no-usa-"))); vi.stubEnv("VEND_OSM_SOURCE", "file");
    const g = vi.fn(async () => new Response("{}")); vi.stubGlobal("fetch", g);
    const f = vi.fn(async () => new Response("{}")) as unknown as typeof fetch;
    const o = await import("./overpass");
    const r = await o.scanPlace({ slug: "nowhere", name: "Nowhere", bbox: { south: 10, west: 10, north: 10.2, east: 10.2 } }, { copyOnly: true, force: true, fetchImpl: f, dropMs: 0 });
    expect(r.notLoaded).toBe(true); expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled(); expect(g).not.toHaveBeenCalled();
  });
  it("the stream route gives a signed-out visitor copyOnly, ignores force, and limits new places", async () => {
    const calls: unknown[] = [];
    vi.doMock("@/lib/auth", () => ({ isOperatorNow: async () => false }));
    vi.doMock("@/lib/places", () => ({ getPlace: async (s: string) => ({ slug: s, name: s, bbox: { south: 1, west: 1, north: 2, east: 2 } }) }));
    vi.doMock("@/lib/blobstore", async (orig) => ({ ...(await orig<typeof import("@/lib/blobstore")>()), storageMissing: () => false }));
    vi.doMock("@/lib/overpass", () => ({ placeIsFresh: async () => false, scanPlace: async (_p: unknown, o: unknown) => { calls.push(o); return { ok: false, skipped: false, usedUnion: false, failed: [], errors: [], notLoaded: true }; } }));
    vi.doMock("@/components/Bft", () => ({ stampString: async () => "x" }));
    const { GET } = await import("@/app/api/scout/stream/route");
    const req = (i: number) => new Request(`http://x/api/scout/stream?place=p${i}&force=1`, { headers: { "x-forwarded-for": "9.9.9.9" } });
    for (let i = 0; i < 5; i++) { const r = await GET(req(i)); expect(r.status).toBe(200); await r.text(); }
    expect(calls).toHaveLength(5);
    for (const o of calls as { copyOnly: boolean; force: boolean }[]) { expect(o.copyOnly).toBe(true); expect(o.force).toBe(false); }
    const sixth = await GET(req(6));
    expect(sixth.status).toBe(429);
    expect(((await sixth.json()) as { error: string }).error).toMatch(/limit/);
    expect(calls).toHaveLength(5);
    const other = await GET(new Request("http://x/api/scout/stream?place=q", { headers: { "x-forwarded-for": "8.8.8.8" } })); expect(other.status).toBe(200); await other.text();
    vi.doUnmock("@/lib/auth"); vi.doUnmock("@/lib/places"); vi.doUnmock("@/lib/overpass"); vi.doUnmock("@/components/Bft");
  });
  it("the public paths hold no live Overpass call: only operators reach it, and the stream is a public path", async () => {
    const route = readFileSync("src/app/api/scout/stream/route.ts", "utf8");
    expect(route).toContain("copyOnly: !op");
    const o = readFileSync("src/lib/overpass.ts", "utf8");
    expect(o.indexOf("opts.copyOnly")).toBeLessThan(o.indexOf("await postOverpass(unionQueryText"));
    expect(o.indexOf("opts.copyOnly")).toBeLessThan(o.indexOf("liveQuery(c, place.bbox, opts.fetchImpl"));
    const sc = readFileSync("src/app/api/scout/route.ts", "utf8");
    expect(sc.indexOf("Operators only")).toBeLessThan(sc.indexOf("getCategory(place, cat, refresh)"));
    const { pathIsPublic } = await import("./operator");
    expect(pathIsPublic("/api/scout/stream", true)).toBe(true);
  });
});

describe("Place Scout pay in parts", () => {
  const file = path.join(os.tmpdir(), `vend-r16-${process.pid}.json`);
  let perform: typeof import("./store").perform, readState: typeof import("./store").readState;
  const put = (o: Record<string, unknown>) => fs.writeFile(file, JSON.stringify(seed(o)));
  const load = async () => { vi.resetModules(); process.env.VEND_STATE_FILE = file; ({ perform, readState } = await import("./store")); };
  beforeEach(() => { process.env.VEND_AI_CHECK = "off"; });
  it("the deal part is due at Yes, the placed part when placed, day 60 only with $800 net a month", async () => {
    await load(); const { scoutRewards } = await import("./scoutpay");
    const st = seed({ tracked: { "osm-n1": "Yes" }, machines: [] }) as never;
    expect(scoutRewards(st).map((r) => r.part)).toEqual(["deal"]);
    expect(scoutRewards(seed({ sales: [] }) as never).map((r) => r.part)).toEqual(["deal", "placed"]);
    const big = [{ machine: "m1", slot: "A1", item: "x", sats: Math.round(usdToSats(800) * 1.06) + 10, at: iso(3), test: false }];
    expect(scoutRewards(seed({ sales: big }) as never).map((r) => r.part)).toEqual(["deal", "placed", "day60"]);
    const small = [{ ...big[0], sats: usdToSats(790) }];
    expect(scoutRewards(seed({ sales: small }) as never).map((r) => r.part)).toEqual(["deal", "placed"]);
    const young = seed({ sales: big, machines: [{ ...(seed().machines[0]), placedAt: iso(30).slice(0, 10) }] });
    expect(scoutRewards(young as never).map((r) => r.part)).toEqual(["deal", "placed"]);
  });
  it("the parts are $25, $25 and $50", async () => {
    await load(); const { PART_USD, scoutPartSats } = await import("./scoutpay");
    expect(PART_USD).toEqual({ deal: 25, placed: 25, day60: 50 });
    expect(scoutPartSats(SATS_PER_USD)).toEqual({ deal: 25 * SATS_PER_USD, placed: 25 * SATS_PER_USD, day60: 50 * SATS_PER_USD });
  });
  it("nothing pays itself: due parts are only listed until the operator approves, then each pays once", async () => {
    await put({}); await load();
    expect((await readState()).payouts ?? []).toHaveLength(0);
    await perform({ action: "stage", id: "osm-n1", stage: "Placed" });
    expect((await readState()).payouts ?? []).toHaveLength(0);
    const a = await perform({ action: "approveScout", key: "osm-n1:deal" });
    expect(a.ok).toBe(true);
    const st = await readState();
    expect(st.payouts).toHaveLength(1); expect(st.payouts[0].sats).toBe(25 * SATS_PER_USD); expect(st.scoutPaid!["osm-n1:deal"].sats).toBe(25 * SATS_PER_USD);
    expect((await perform({ action: "approveScout", key: "osm-n1:deal" })).ok).toBe(false);
    expect((await readState()).payouts).toHaveLength(1);
    expect((await perform({ action: "approveScout", key: "osm-n1:nothing" })).ok).toBe(false);
  });
  it("a part that comes due after the scout left the crew is forfeited, shown that way, and never paid", async () => {
    await put({ applicants: [{ ...seed().applicants[0], stage: "Declined" }], tracked: { "osm-n1": "Yes" }, machines: [] }); await load();
    const { scoutRewards, FORFEIT_LINE } = await import("./scoutpay");
    expect(scoutRewards(await readState()).map((r) => r.state)).toEqual(["forfeited"]);
    expect(FORFEIT_LINE).toBe("Forfeited, scout left the crew");
    const r = await perform({ action: "approveScout", key: "osm-n1:deal" });
    expect(r.ok).toBe(false); expect(r.error).toContain("Forfeited, scout left the crew");
    const st = await readState();
    expect(st.payouts ?? []).toHaveLength(0); expect(st.scoutForfeit!["osm-n1:deal"]).toBeTruthy();
  });
  it("a forfeit sticks even if the scout is back on the crew later", async () => {
    await put({ applicants: [{ ...seed().applicants[0], stage: "Declined" }], tracked: { "osm-n1": "Yes" }, machines: [] }); await load();
    await perform({ action: "stage", id: "osm-n1", stage: "Yes" }); // any action settles forfeits
    const st = await readState(); st.applicants[0].stage = "On the crew";
    const { scoutRewards } = await import("./scoutpay");
    expect(scoutRewards(st)[0].state).toBe("forfeited");
  });
  it("a scout pitch job itself pays nothing at proof approval", async () => {
    const { satsFor } = await import("./crew");
    expect(satsFor("scout", SATS_PER_USD)).toBe(0);
  });
});

describe("crew page copy and the postings feed", () => {
  it("says half, half and a day 60 bonus in sats, with no dollar sign", () => {
    const s = readFileSync("src/app/crew/page.tsx", "utf8");
    expect(s).toContain("About half when the deal is set"); expect(s).toContain("half when the machine goes in"); expect(s).toContain("at day 60 if it sells well");
    expect(s).not.toMatch(/\$\d/);
  });
  it("the feed says startingRate, not testRate", () => {
    expect(readFileSync("src/app/api/crew/postings/route.ts", "utf8")).toContain("startingRate");
    expect(readFileSync("src/lib/frensPosting.ts", "utf8")).not.toContain("testRate");
  });
  it("sats lock at approval: the job approval reads the price when the operator approves", () => {
    const s = readFileSync("src/lib/store.ts", "utf8");
    expect(s).toContain("c.sats = sats; c.paidSats = sats");
    expect(s).toContain("(await satsPrice()).satsPerUsd, sats = usdToSats(r.usd, spu)");
  });
});
