import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const mem = new Map<string, string | Buffer>();
const puts: { name: string; access: string }[] = [];
vi.mock("@vercel/blob", () => ({
  put: async (name: string, data: string | Buffer, o: { access: string }) => { mem.set(name, data); puts.push({ name, access: o.access }); return { pathname: name }; },
  get: async (name: string) => (mem.has(name) ? { statusCode: 200, stream: new Response(mem.get(name) as BodyInit).body } : null),
}));
beforeEach(() => { mem.clear(); puts.length = 0; vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("storage adapter, file driver", () => {
  it("uses files when VEND_STATE_FILE is set, even with a blob token", async () => {
    const f = path.join(os.tmpdir(), `vend-adapter-${process.pid}.json`);
    vi.stubEnv("VEND_STATE_FILE", f); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "x");
    const b = await import("./blobstore");
    expect(b.driver()).toBe("file");
    await b.writeStateText('{"a":1}');
    expect(await fs.readFile(f, "utf8")).toBe('{"a":1}');
    expect(await b.readStateText()).toBe('{"a":1}');
    expect(puts.length).toBe(0);
  });
  it("refuses paths that climb out", async () => {
    vi.stubEnv("VEND_STATE_FILE", "/tmp/x.json");
    const b = await import("./blobstore");
    expect(await b.readBin("../secret")).toBeNull();
    await expect(b.writeBin("a/../b", "x")).rejects.toThrow();
  });
});

describe("storage adapter, blob driver", () => {
  it("uses private blobs when the token is set and no state file", async () => {
    vi.stubEnv("VEND_STATE_FILE", ""); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "x");
    const b = await import("./blobstore");
    expect(b.driver()).toBe("blob");
    await b.writeStateText('{"b":2}');
    await b.writeBin("stops/r1-1.png", Buffer.from([1, 2, 3]), "image/png");
    expect(await b.readStateText()).toBe('{"b":2}');
    expect([...(await b.readBin("stops/r1-1.png"))!]).toEqual([1, 2, 3]);
    expect(await b.readBin("stops/none.png")).toBeNull();
    expect(puts.every((p) => p.access === "private")).toBe(true);
    expect(puts.map((p) => p.name)).toEqual(["vend/state.json", "vend/stops/r1-1.png"]);
  });
  it("the store starts EMPTY on a fresh blob store", async () => {
    vi.stubEnv("VEND_STATE_FILE", ""); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "x");
    const s = await import("./store");
    const st = await s.readState();
    expect(st.machines).toEqual([]); expect(st.applicants).toEqual([]); expect(st.proofs).toEqual([]);
  });
});
