import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
let mode: { putFails?: boolean; originFails?: boolean; getNull?: boolean } = {};
vi.mock("@vercel/blob", () => ({
  put: async (name: string, data: string) => { if (mode.putFails) throw Object.assign(new Error("Vercel Blob: This store is public, use access public. token vercel_blob_rw_AbC123_secret"), { name: "BlobError" }); mem.set(name, data); return { pathname: name }; },
  get: async (name: string, o: { useCache?: boolean }) => {
    if (o.useCache === false && mode.originFails) throw Object.assign(new Error("Failed to fetch blob: 400 Bad Request"), { name: "BlobError" });
    if (mode.getNull || !mem.has(name)) return null;
    return { statusCode: 200, stream: new Response(mem.get(name)).body };
  },
}));
let errs: string[] = [], infos: string[] = [];
beforeEach(() => {
  mem.clear(); mode = {}; errs = []; infos = []; vi.resetModules();
  vi.stubEnv("VEND_STATE_FILE", ""); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_AbC123_secret");
  vi.spyOn(console, "error").mockImplementation((...a) => { errs.push(a.join(" ")); });
  vi.spyOn(console, "info").mockImplementation((...a) => { infos.push(a.join(" ")); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("storage failures are logged and never silent", () => {
  it("a failed write throws, logs the path and the reason, and never prints the token", async () => {
    mode.putFails = true;
    const b = await import("./blobstore");
    await expect(b.writeText("cache/denver/overpass-gym.json", "{}")).rejects.toThrow();
    const line = errs.find((l) => l.includes("[vend-store] write failed"))!;
    expect(line).toContain("cache/denver/overpass-gym.json");
    expect(line).toContain("BlobError");
    expect(line).not.toContain("AbC123");
  });
  it("a scan whose saves fail reports not-ok with the real error text", async () => {
    mode.putFails = true;
    const o = await import("./overpass");
    const f = (async () => new Response(JSON.stringify({ elements: [{ id: 1, type: "node", lat: 41.9, lon: -87.6, tags: { shop: "laundry", name: "A" } }] }))) as unknown as typeof fetch;
    const r = await o.scanPlace({ slug: "denver", name: "Denver", bbox: { south: 39.6, west: -105.1, north: 39.9, east: -104.6 } }, { fetchImpl: f });
    expect(r.ok).toBe(false);
    expect(r.failed.length).toBe(7);
    expect(r.errors[0]).toContain("BlobError");
    expect(r.errors[0]).not.toContain("AbC123");
    expect(errs.some((l) => l.includes("[vend-scan] could not save"))).toBe(true);
  });
  it("a successful scan write logs one line per category with the driver", async () => {
    const o = await import("./overpass");
    const f = (async () => new Response(JSON.stringify({ elements: [{ id: 1, type: "node", lat: 41.9, lon: -87.6, tags: { shop: "laundry", name: "A" } }] }))) as unknown as typeof fetch;
    const r = await o.scanPlace({ slug: "denver", name: "Denver", bbox: { south: 39.6, west: -105.1, north: 39.9, east: -104.6 } }, { fetchImpl: f });
    expect(r.ok).toBe(true);
    expect(infos.filter((l) => l.startsWith("[vend-scan] wrote cache/denver/overpass-")).length).toBe(7);
    expect(infos.some((l) => l.includes("overpass-laundry.json 1 items driver=blob"))).toBe(true);
    const counts = await o.cacheCounts("denver");
    expect(counts.laundry).toBe(1);
  });
  it("if the origin read errors, it logs and still finds the saved file with a normal read", async () => {
    const b = await import("./blobstore");
    await b.writeText("cache/x.json", '{"a":1}');
    mode.originFails = true;
    expect(await b.readText("cache/x.json")).toBe('{"a":1}');
    expect(errs.some((l) => l.includes("[vend-store] origin read failed"))).toBe(true);
  });
  it("the storage probe says plainly when a write is saved but cannot be read back", async () => {
    mode.getNull = true;
    const b = await import("./blobstore");
    const p = await b.storageProbe();
    expect(p).toMatchObject({ driver: "blob", wrote: true, read: false });
    expect(p.error).toContain("reading it back");
    mode = {}; mode.putFails = true;
    const q = await b.storageProbe();
    expect(q.wrote).toBe(false);
    expect(q.error).toContain("write:");
  });
});
