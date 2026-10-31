import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory Blob, so these tests never write into the real data folder.
const mem = new Map<string, string>();
vi.mock("@vercel/blob", () => ({
  put: async (name: string, data: string) => { mem.set(name, data); return { pathname: name }; },
  get: async (name: string) => (mem.has(name) ? { statusCode: 200, stream: new Response(mem.get(name)).body } : null),
}));

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const place = { slug: "denver", name: "Denver", bbox: { south: 39.6, west: -105.1, north: 39.9, east: -104.6 } };
const ok = (elements: unknown[]) => new Response(JSON.stringify({ elements }));

describe("storage missing fails loud", () => {
  it("on Vercel with no token the driver is none, never file", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", ""); vi.stubEnv("VEND_STATE_FILE", "");
    const b = await import("./blobstore");
    expect(b.driver()).toBe("none");
    expect(b.storageMissing()).toBe(true);
    await expect(b.writeText("cache/x.json", "{}")).rejects.toThrow(b.STORAGE_MISSING);
    await expect(b.writeStateText("{}")).rejects.toThrow(b.STORAGE_MISSING);
    expect(await b.readText("cache/x.json")).toBeNull();
    const p = await b.storageProbe();
    expect(p).toMatchObject({ driver: "none", wrote: false });
    expect(p.error).toBe("Storage is not connected. Connect the Blob store to this project in Vercel, then redeploy.");
  });
  it("with a token it is blob, locally it is file", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "t"); vi.stubEnv("VEND_STATE_FILE", "");
    expect((await import("./blobstore")).driver()).toBe("blob");
    vi.stubEnv("VERCEL", ""); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect((await import("./blobstore")).driver()).toBe("file");
  });
  it("a scan refuses before it calls Overpass", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", ""); vi.stubEnv("VEND_STATE_FILE", "");
    const f = vi.fn(async () => ok([])) as unknown as typeof fetch;
    const o = await import("./overpass");
    const r = await o.scanPlace(place, { fetchImpl: f });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("Storage is not connected");
    expect(f).not.toHaveBeenCalled();
  });
  it("the stream route answers 503 with the sentence and never starts", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", ""); vi.stubEnv("VEND_STATE_FILE", ""); vi.stubEnv("VEND_REQUIRE_OPERATOR", "");
    vi.doMock("@/lib/auth", () => ({ isOperatorNow: async () => true }));
    const { GET } = await import("@/app/api/scout/stream/route");
    const r = await GET(new Request("http://x/api/scout/stream?place=chicago"));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain("Storage is not connected");
    vi.doUnmock("@/lib/auth");
  });
});

describe("Overpass failover", () => {
  it("the union query tries every server (and goes round once more) before the per-kind fallback", async () => {
    vi.stubEnv("VEND_STATE_FILE", ""); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "t");
    const calls: string[] = [];
    const f = (async (url: string) => { calls.push(url); return calls.length < 3 ? new Response("busy", { status: 502 }) : ok([{ id: 1, type: "node", lat: 41.9, lon: -87.6, tags: { shop: "laundry", name: "A" } }]); }) as unknown as typeof fetch;
    const notes: string[] = [];
    const o = await import("./overpass");
    const r = await o.scanPlace(place, { fetchImpl: f, onNote: (m) => notes.push(m), pauseMs: 0, force: true });
    expect(r.usedUnion).toBe(true);
    expect(calls.length).toBe(3); // server A, server B, then A again, which answered
    expect(new Set(calls).size).toBe(2);
    expect(notes).toContain("The map server is busy, trying another one");
  });
  it("only when every server failed twice does it fall back to one kind at a time, and it says so", async () => {
    vi.stubEnv("VEND_STATE_FILE", ""); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "t");
    let n = 0;
    const f = (async () => { n++; return n <= 4 ? new Response("busy", { status: 502 }) : ok([]); }) as unknown as typeof fetch;
    const notes: string[] = [];
    const o = await import("./overpass");
    const r = await o.scanPlace(place, { fetchImpl: f, onNote: (m) => notes.push(m), pauseMs: 0, force: true });
    expect(r.usedUnion).toBe(false);
    expect(notes).toContain("The one-shot query failed on every server. Asking one kind at a time.");
    expect(n).toBeGreaterThan(4);
  });
});

describe("storage credentials and driver choice", () => {
  const cases: [string, Record<string, string>, string, string][] = [
    ["Vercel, read-write token", { VERCEL: "1", BLOB_READ_WRITE_TOKEN: "t", BLOB_STORE_ID: "" }, "blob", "read-write token"],
    ["Vercel, store id only (OIDC)", { VERCEL: "1", BLOB_READ_WRITE_TOKEN: "", BLOB_STORE_ID: "store_abc" }, "blob", "store id (OIDC)"],
    ["Vercel, both", { VERCEL: "1", BLOB_READ_WRITE_TOKEN: "t", BLOB_STORE_ID: "store_abc" }, "blob", "read-write token"],
    ["Vercel, neither", { VERCEL: "1", BLOB_READ_WRITE_TOKEN: "", BLOB_STORE_ID: "" }, "none", "none"],
    ["local, neither", { VERCEL: "", BLOB_READ_WRITE_TOKEN: "", BLOB_STORE_ID: "" }, "file", "none"],
    ["local, store id", { VERCEL: "", BLOB_READ_WRITE_TOKEN: "", BLOB_STORE_ID: "store_abc" }, "blob", "store id (OIDC)"],
  ];
  for (const [name, env, drv, cred] of cases) {
    it(`${name} -> ${drv} / ${cred}`, async () => {
      vi.stubEnv("VEND_STATE_FILE", "");
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      const b = await import("./blobstore");
      expect(b.driver()).toBe(drv);
      expect(b.credentials()).toBe(cred);
      expect(b.storageMissing()).toBe(drv === "none");
    });
  }
  it("a state file always means file, whatever credentials exist", async () => {
    vi.stubEnv("VEND_STATE_FILE", "/tmp/x.json"); vi.stubEnv("VERCEL", "1"); vi.stubEnv("BLOB_STORE_ID", "store_abc");
    expect((await import("./blobstore")).driver()).toBe("file");
  });
  it("the library is never handed a token option", async () => {
    const src = (await import("fs")).readFileSync("src/lib/blobstore.ts", "utf8");
    expect(src).not.toMatch(/(get|put)\([^)]*\btoken\b/);
  });
});
