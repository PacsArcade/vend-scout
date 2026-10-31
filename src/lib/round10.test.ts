import { describe, expect, it } from "vitest";
import { categoriesOf, LAND_ORDER, splitUnion, unionQueryText } from "./overpass";
import { runDailyScan } from "./cron";
import { scorePlace, scoutMachineValue, noMachineValue } from "./score";
import { scoutAward } from "./arcade";
import { ARCADE } from "./gig";

type Raw = { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
const raw: Raw[] = [
  { id: 1, type: "node", lat: 41.9, lon: -87.6, tags: { shop: "laundry", name: "Suds", opening_hours: "24/7", phone: "+1 312 555 0100" } },
  { id: 2, type: "way", center: { lat: 41.8, lon: -87.7 }, tags: { leisure: "fitness_centre", name: "Gym" } },
  { id: 3, type: "node", lat: 41.7, lon: -87.5, tags: { amenity: "vending_machine" } },
  { id: 4, type: "node", lat: 41.6, lon: -87.4, tags: { shop: "convenience", amenity: "fast_food" } }, // in two kinds
  { id: 5, type: "node", tags: { shop: "laundry" } }, // no position: dropped
  { id: 6, type: "node", lat: 41.5, lon: -87.3, tags: { shop: "bakery" } }, // none of ours
];

describe("one union query", () => {
  it("asks for all seven kinds in one query", () => {
    const q = unionQueryText({ south: 41, west: -88, north: 42, east: -87 });
    expect(q.startsWith("[out:json]")).toBe(true);
    for (const f of ["shop=laundry", "leisure=fitness_centre", "amenity=car_wash", "shop=car_repair", "amenity=vending_machine", "shop=convenience", "amenity=fast_food"]) expect(q).toContain(`[${f}]`);
    expect((q.match(/out center tags/g) ?? []).length).toBe(1);
  });
  it("splits the same as seven separate queries would", () => {
    const split = splitUnion(raw);
    const perCategory = (c: string) => raw.filter((e) => categoriesOf(e.tags).includes(c as never) && (e.lat !== undefined || e.center)).map((e) => e.id);
    for (const c of LAND_ORDER) expect(split[c].map((x) => x.id)).toEqual(perCategory(c));
    expect(split.laundry.map((x) => x.id)).toEqual([1]);
    expect(split.convenience.map((x) => x.id)).toEqual([4]);
    expect(split.fast_food.map((x) => x.id)).toEqual([4]);
    expect(split.gym[0].lat).toBe(41.8); // a way takes its centre
    expect(split.laundry[0].tags?.phone).toBe("+1 312 555 0100");
  });
});

describe("daily scan cron", () => {
  const places = ["a", "b", "c", "d"].map((s) => ({ slug: s, name: s, bbox: { south: 0, west: 0, north: 1, east: 1 } }));
  const base = (over: object = {}) => ({ places, isFresh: async () => false, ageOf: async (s: string) => ({ a: 400, b: 100, c: 0, d: 300 } as Record<string, number>)[s], scan: async () => ({ ok: true, failed: [], usedUnion: true }), now: () => 0, budgetMs: 1000, perCityMs: 100, ...over });
  it("skips fresh cities (never more than once a day each)", async () => {
    const scanned: string[] = [];
    const r = await runDailyScan(base({ isFresh: async (s: string) => s === "a" || s === "d", scan: async (p: { slug: string }) => { scanned.push(p.slug); return { ok: true, failed: [], usedUnion: true }; } }));
    expect(r.skippedFresh).toEqual(["a", "d"]);
    expect(scanned.sort()).toEqual(["b", "c"]);
  });
  it("does the oldest first and defers what does not fit, so tomorrow starts with them", async () => {
    let t = 0; const order: string[] = [];
    const r = await runDailyScan(base({ now: () => t, budgetMs: 250, perCityMs: 100, scan: async (p: { slug: string }) => { order.push(p.slug); t += 100; return { ok: true, failed: [], usedUnion: true }; } }));
    expect(order).toEqual(["c", "b"]); // never scanned first, then the older of the rest; the next did not fit
    expect(r.deferred).toEqual(["d", "a"]);
  });
  it("one failing city does not stop the rest", async () => {
    const r = await runDailyScan(base({ scan: async (p: { slug: string }) => { if (p.slug === "c") throw new Error("x"); return { ok: true, failed: [], usedUnion: true }; } }));
    expect(r.failed).toEqual(["c"]);
    expect(r.scanned.length).toBe(3);
  });
  it("the route refuses without the secret and with a wrong one", async () => {
    const { GET } = await import("@/app/api/cron/scan/route");
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("http://x/api/cron/scan"))).status).toBe(401);
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(new Request("http://x/api/cron/scan"))).status).toBe(401);
    expect((await GET(new Request("http://x/api/cron/scan", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    delete process.env.CRON_SECRET;
  });
});

describe("scout check replaces the map guess", () => {
  const input = { category: "laundry" as const, openingHours: "24/7", hasName: true, hasAddress: true, nearestMachineM: 50, sameNear: 0, foodLateNear: 0 };
  const machineFactor = (r: ReturnType<typeof scorePlace>) => r.factors.find((f) => f.key === "machine")!;
  it("with no check the map guess is used", () => expect(machineFactor(scorePlace(input)).value).toBe(noMachineValue(50).value));
  it("a check of none beats a machine that the map showed nearby, and names itself with its stamp", () => {
    const f = machineFactor(scorePlace({ ...input, scout: { inside: "none", room: "unsure", stamp: "0018.08.16 22:00 a₿" } }));
    expect(f.value).toBe(100);
    expect(f.note).toContain("Scout check 0018.08.16 22:00 a₿");
  });
  it("a combo inside scores low, room for another softens it, a broken machine softens it too", () => {
    const v = (o: object) => scoutMachineValue({ inside: "combo", room: "unsure", stamp: "s", ...o }).value;
    expect(v({})).toBe(5);
    expect(v({ room: "yes" })).toBe(40);
    expect(v({ state: "Broken" })).toBe(25);
    expect(v({ room: "no" })).toBe(5);
  });
  it("a check can raise the whole score", () => {
    const a = scorePlace(input).score;
    const b = scorePlace({ ...input, scout: { inside: "none", room: "unsure", stamp: "s" } }).score;
    expect(b).toBeGreaterThan(a);
  });
});

describe("scout points", () => {
  it("each part earns its own points", () => {
    expect(scoutAward({ photo: "p.png", who: "", room: "unsure" }).points).toBe(ARCADE.scoutPhoto);
    expect(scoutAward({ who: "Joe's Vending", room: "unsure" }).points).toBe(ARCADE.scoutWho);
    expect(scoutAward({ who: "", state: "Worn", room: "unsure" }).points).toBe(ARCADE.scoutState);
    expect(scoutAward({ who: "", room: "yes" }).points).toBe(ARCADE.scoutRoom);
    expect(scoutAward({ who: "", room: "no" }).points).toBe(ARCADE.scoutRoom);
    expect(scoutAward({ photo: "p", who: "x", state: "Worn", room: "yes" }).points).toBe(ARCADE.scoutPhoto + ARCADE.scoutWho + ARCADE.scoutState + ARCADE.scoutRoom);
    expect(scoutAward({ who: "", room: "unsure" }).points).toBe(0);
  });
  it("no speed inside the scout award", () => {
    const keys = Object.keys(ARCADE).filter((k) => k.startsWith("scout"));
    expect(keys.some((k) => /speed|time|minute|second/i.test(k))).toBe(false);
  });
});

import { mentionsVending } from "./contacts";
describe("website vending hint", () => {
  it("flags vending words and ignores code and plain pages", () => {
    expect(mentionsVending("<p>Snack machines and vending available 24/7</p>")).toBe(true);
    expect(mentionsVending("<p>Wash and fold, drop off today</p>")).toBe(false);
    expect(mentionsVending("<script>var vending = 1</script><p>hello</p>")).toBe(false);
  });
});
