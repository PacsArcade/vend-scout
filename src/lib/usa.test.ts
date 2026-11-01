import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { gzipSync } from "zlib";
import { cutUsa, resetUsaMemo, stateFile, statesFor, usaIndex } from "./usa";
import { STATES, STATE_SLUGS, stateFromName, stateName } from "./states";

const el = (id: number, lat: number, lon: number, type = "node") => ({ id, type, lat, lon, name: "n" + id });
let dir = "";
const put = (state: string, cat: string, items: unknown[]) => {
  mkdirSync(path.join(dir, state), { recursive: true });
  writeFileSync(path.join(dir, state, `${cat}.json.gz`), gzipSync(JSON.stringify({ v: 2, fetchedAt: 1700000000000, items })));
};

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "usa-"));
  process.env.VEND_OSM_DIR = dir; process.env.VEND_OSM_SOURCE = "file"; resetUsaMemo();
  const b = (south: number, north: number, west: number, east: number) => ({ south, north, west, east });
  writeFileSync(path.join(dir, "usa-index.json"), JSON.stringify({ v: 1, states: {
    texas: { extractedAt: 1, counts: {}, total: 3, bytes: {}, bounds: b(26, 36, -106, -94) },
    oklahoma: { extractedAt: 1, counts: {}, total: 3, bytes: {}, bounds: b(33.6, 37, -103, -94.4) },
    maine: { extractedAt: 1, counts: {}, total: 3, bytes: {}, bounds: b(43, 47, -71, -67) },
  } }));
  put("texas", "laundry", [el(1, 30.27, -97.74), el(2, 35.9, -97.0), el(3, 25, -100)]);
  put("oklahoma", "laundry", [el(2, 35.9, -97.0), el(9, 35.5, -97.5)]);
});
afterEach(() => { delete process.env.VEND_OSM_DIR; delete process.env.VEND_OSM_SOURCE; resetUsaMemo(); });

describe("state names", () => {
  it("has 53 regions (52 downloaded plus bundled Illinois) and round-trips every Nominatim-style name", () => {
    expect(STATE_SLUGS.length).toBe(53); expect(new Set(STATE_SLUGS).size).toBe(53);
    for (const s of STATES) expect(stateFromName(s.name)).toBe(s.slug);
    expect(stateFromName("United States Virgin Islands")).toBe("us-virgin-islands");
    expect(stateFromName("Washington, D.C.")).toBe("district-of-columbia");
    expect(stateFromName("Ontario")).toBeNull(); expect(stateFromName(undefined)).toBeNull();
    expect(stateName("new-hampshire")).toBe("New Hampshire");
  });
});

describe("USA state files", () => {
  it("reads the index and finds the states a box touches, hint first", async () => {
    expect(Object.keys((await usaIndex())!.states).length).toBe(3);
    const austin = { south: 30.1, north: 30.5, west: -98, east: -97.5 };
    expect(await statesFor(austin)).toEqual(["texas"]);
    const border = { south: 35, north: 36.5, west: -98, east: -96 };
    expect((await statesFor(border)).sort()).toEqual(["oklahoma", "texas"]);
    expect((await statesFor(border, "oklahoma"))[0]).toBe("oklahoma");
    expect(await statesFor({ south: 10, north: 11, west: 10, east: 11 })).toEqual([]);
  });
  it("cuts a box from one or two states and drops the duplicate on the border", async () => {
    const r = await cutUsa("laundry", { south: 35, north: 36.5, west: -98, east: -96 }, ["texas", "oklahoma"]);
    expect(r!.items.map((e) => e.id).sort()).toEqual([2, 9]);
    expect(r!.fetchedAt).toBe(1700000000000);
  });
  it("returns null (so the app falls back to Overpass) when a state file is missing, and refuses odd names", async () => {
    expect(await cutUsa("gym", { south: 30, north: 31, west: -98, east: -97 }, ["texas"])).toBeNull();
    expect(await stateFile("../etc", "laundry")).toBeNull();
    expect(await stateFile("texas", "../x")).toBeNull();
  });
  it("keeps a loaded file in memory", async () => {
    const a = stateFile("texas", "laundry"); expect(stateFile("texas", "laundry")).toBe(a);
  });
});

describe("the build and upload scripts", () => {
  const py = path.join(process.cwd(), "scripts/osm-build/.venv/bin/python");
  it.skipIf(!existsSync(py))("build.py writes gzip, bounds and byte sizes for a state", () => {
    const out = mkdtempSync(path.join(os.tmpdir(), "osmgz-"));
    execFileSync(py, ["scripts/osm-build/build.py", "--pbf", "scripts/osm-build/fixtures/tiny.osm", "--out", out, "--state", "delaware", "--gzip", "--no-cities", "--no-areas", "--timestamp-ms", "1700000000000"]);
    const meta = JSON.parse(readFileSync(path.join(out, "delaware/meta.json"), "utf8"));
    expect(meta.bounds.south).toBeLessThanOrEqual(meta.bounds.north); expect(meta.bytes.laundry).toBeGreaterThan(0);
    expect(existsSync(path.join(out, "cities"))).toBe(false);
    expect(existsSync(path.join(out, "delaware/laundry.json.gz"))).toBe(true);
  });
  it("upload.mjs reads the token by name, sends the index last and never prints a token", () => {
    const js = readFileSync("scripts/osm-build/upload.mjs", "utf8");
    expect(js).toContain("BLOB_READ_WRITE_TOKEN"); expect(js).toContain("allowOverwrite: true"); expect(js).toContain('access: "private"');
    expect(js.indexOf('send("osm/usa-index.json"')).toBeGreaterThan(js.lastIndexOf("`osm/${s}/${f}`"));
    expect(js).not.toMatch(/console\.(log|error)\([^)]*\btok\b(?!\))/);
    expect(js).toContain("[token]");
  });
});
