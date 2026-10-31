import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { cronPlaces } from "./cron";
import { CHICAGO, IL_CITIES, ILLINOIS } from "./places";

const py = path.join(process.cwd(), "scripts/osm-build/.venv/bin/python");
const hasPy = existsSync(py);

describe("OSM extractor on a tiny fixture", () => {
  it.skipIf(!hasPy)("keeps a node, gives a way a centre, drops other tags and other places, and writes the cache shape", () => {
    const out = mkdtempSync(path.join(os.tmpdir(), "osm-"));
    execFileSync(py, ["scripts/osm-build/build.py", "--pbf", "scripts/osm-build/fixtures/tiny.osm", "--out", out, "--cities", "scripts/osm-build/fixtures/cities.json", "--timestamp-ms", "1700000000000"], { cwd: process.cwd() });
    const read = (r: string) => JSON.parse(readFileSync(path.join(out, r), "utf8"));
    const laundry = read("cities/chicago/laundry.json");
    expect(laundry).toEqual({ v: 2, fetchedAt: 1700000000000, items: [{ id: 1, type: "node", lat: 41.9, lon: -87.6, name: "Suds Test", opening_hours: "24/7", street: "12 Main Street", tags: { phone: "+1 312 555 0100" } }] });
    const gym = read("cities/chicago/gym.json").items[0];
    expect(gym).toMatchObject({ id: 100, type: "way", lat: 41.75, lon: -87.65, name: "Gym Test", tags: { website: "https://gym.example" } }); // the middle of the way's box
    expect(read("cities/chicago/convenience.json").items.length).toBe(1);
    expect(read("cities/chicago/fast_food.json").items.length).toBe(1); // one way, two kinds
    expect(read("cities/chicago/vending.json").items[0].id).toBe(6);
    expect(read("illinois/laundry.json").items.length).toBe(2); // statewide has the one outside the city box too
    expect(read("cities/chicago/car_wash.json").items).toEqual([]);
    expect(read("meta.json").extractedAt).toBe(1700000000000);
  });
  it("uses the same schema number and tag filters as overpass.ts", () => {
    const ts = readFileSync("src/lib/overpass.ts", "utf8");
    const pyts = readFileSync("scripts/osm-build/build.py", "utf8");
    expect(ts.match(/const SCHEMA = (\d+)/)?.[1]).toBe(pyts.match(/SCHEMA = (\d+)/)?.[1]);
    const filters = [...ts.matchAll(/^\s+(\w+): "(\w+)=(\w+)",$/gm)];
    expect(filters.length).toBe(7);
    for (const [, kind, k, v] of filters) expect(pyts).toContain(`"${kind}": ("${k}", "${v}")`);
  });
  it("the city boxes match the ones the app uses", () => {
    const json = JSON.parse(readFileSync("scripts/osm-build/cities.json", "utf8")) as Record<string, Record<string, number>>;
    for (const p of [CHICAGO, ...IL_CITIES]) {
      expect(Object.keys(json)).toContain(p.slug);
      for (const k of ["south", "west", "north", "east"] as const) expect(json[p.slug][k]).toBeCloseTo(p.bbox[k], 4);
    }
    expect(Object.keys(json).length).toBe(9);
  });
});

describe("the app reads our own copy first", () => {
  const stored = new Map<string, string>();
  beforeEach(() => {
    vi.resetModules(); stored.clear();
    vi.doMock("./blobstore", async (orig) => ({ ...(await orig<typeof import("./blobstore")>()), readText: async (r: string) => stored.get(r) ?? null, writeText: async (r: string, t: string) => { stored.set(r, t); }, storageMissing: () => false }));
  });
  afterEach(() => { vi.doUnmock("./blobstore"); vi.unstubAllEnvs(); });
  it("the built-in Chicago data is read from the repo and marked as our copy", async () => {
    const o = await import("./overpass");
    const k = await o.readCache("chicago", "laundry");
    expect(k?.src).toBe("bundle");
    expect(k!.items.length).toBeGreaterThan(50);
    expect(k!.v).toBe(2);
  });
  it("a newer saved scan beats the copy, an older one does not", async () => {
    const o = await import("./overpass");
    const b = (await o.readCache("chicago", "laundry"))!;
    stored.set("cache/chicago/overpass-laundry.json", JSON.stringify({ v: 2, fetchedAt: b.fetchedAt - 1000, items: [] }));
    expect((await o.readCache("chicago", "laundry"))!.items.length).toBe(b.items.length);
    stored.set("cache/chicago/overpass-laundry.json", JSON.stringify({ v: 2, fetchedAt: b.fetchedAt + 1000, items: [{ id: 9, type: "node", lat: 41.9, lon: -87.6 }] }));
    expect((await o.readCache("chicago", "laundry"))!.items.length).toBe(1);
  });
  it("Scan this place on a built-in city is instant, never calls Overpass, and needs no storage", async () => {
    vi.doMock("./blobstore", async (orig) => ({ ...(await orig<typeof import("./blobstore")>()), storageMissing: () => true }));
    const o = await import("./overpass");
    const f = vi.fn() as unknown as typeof fetch;
    const seen: string[] = [];
    const r = await o.scanPlace(CHICAGO, { fetchImpl: f, dropMs: 0, onCategory: (c) => { seen.push(c); } });
    expect(r.ok).toBe(true);
    expect(r.source).toBe("bundle");
    expect(r.extractedAt).toBeGreaterThan(0);
    expect(seen).toEqual(["laundry", "gym", "car_wash", "car_repair", "vending", "convenience", "fast_food"]);
    expect(f).not.toHaveBeenCalled();
  });
  it("another Illinois place is cut from the statewide files and saved, with no Overpass call", async () => {
    const o = await import("./overpass");
    const f = vi.fn() as unknown as typeof fetch;
    const bloomington = { slug: "bloomington-il", name: "Bloomington, Illinois", bbox: { south: 40.4, west: -89.1, north: 40.6, east: -88.85 } };
    const r = await o.scanPlace(bloomington, { fetchImpl: f, dropMs: 0 });
    expect(r.source).toBe("bundle");
    expect(f).not.toHaveBeenCalled();
    const saved = JSON.parse(stored.get("cache/bloomington-il/overpass-fast_food.json")!);
    expect(saved.src).toBe("bundle");
    expect(saved.items.length).toBeGreaterThan(5);
    expect(saved.items.every((e: { lat: number }) => e.lat >= 40.4 && e.lat <= 40.6)).toBe(true);
  });
  it("a place outside Illinois still goes to Overpass", async () => {
    vi.stubEnv("VEND_STATE_FILE", "");
    const o = await import("./overpass");
    const f = vi.fn(async () => new Response(JSON.stringify({ elements: [] }))) as unknown as typeof fetch;
    const denver = { slug: "denver", name: "Denver", bbox: { south: 39.6, west: -105.1, north: 39.9, east: -104.6 } };
    const r = await o.scanPlace(denver, { fetchImpl: f, dropMs: 0, pauseMs: 0, force: true });
    expect(f).toHaveBeenCalled();
    expect(r.source).toBeUndefined();
  });
});

describe("daily cron", () => {
  it("skips the nine built-in cities and keeps only searched places", () => {
    const searched = { slug: "denver", name: "Denver", bbox: CHICAGO.bbox };
    const left = cronPlaces([...ILLINOIS, searched], ILLINOIS.map((c) => c.slug));
    expect(left.map((p) => p.slug)).toEqual(["denver"]);
    expect(cronPlaces(ILLINOIS, ILLINOIS.map((c) => c.slug))).toEqual([]);
  });
});
