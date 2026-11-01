// The USA place data: one state at a time, built on the house box (scripts/osm-build) and kept in the Vercel Blob store under osm/<state>/<kind>.json.gz.
// Locally it reads the same files from osm-out/. A state's file is loaded when first needed and kept in memory for this instance.
// Illinois is bundled with the app (data-osm/) and does not come through here.
import { promises as fs } from "fs";
import path from "path";
import { gunzip } from "zlib";
import { promisify } from "util";
import { get } from "@vercel/blob";
import { driver, errText } from "./blobstore";
import type { Bbox } from "./types";
import type { OsmElement } from "./overpass";
import { STATE_SLUGS } from "./states";

const gunzipP = promisify(gunzip);
const local = () => process.env.VEND_OSM_DIR || path.join(process.cwd(), "osm-out");

export interface UsaState { extractedAt: number; md5?: string | null; counts: Record<string, number>; total: number; bytes: Record<string, number>; bounds: Bbox | null }
export interface UsaIndex { v: number; states: Record<string, UsaState> }
export interface StateFile { v?: number; fetchedAt: number; items: OsmElement[] }

/** Where the files come from. "blob" on Vercel (or with a token); "file" at home. VEND_OSM_SOURCE=blob|file overrides (used to prove the Blob copy from a laptop). */
export function osmSource(): "blob" | "file" | "none" {
  const forced = process.env.VEND_OSM_SOURCE;
  if (forced === "blob" || forced === "file") return forced;
  const d = driver();
  return d === "blob" ? "blob" : d === "none" ? "none" : "file";
}

const raw = async (rel: string): Promise<Buffer | null> => {
  const src = osmSource();
  if (src === "none") return null;
  if (src === "file") {
    try { return await fs.readFile(path.join(local(), rel.replace(/^osm\//, ""))); } catch { return null; }
  }
  try {
    // The files are replaced by the nightly refresh, so the index must be read from origin; the big files may use the edge copy.
    const res = await get(rel, { access: "private", useCache: !rel.endsWith("usa-index.json") });
    if (!res || res.statusCode !== 200) { console.info(`[vend-usa] miss ${rel} (not found)`); return null; }
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  } catch (e) { console.error(`[vend-usa] read failed ${rel} ${errText(e)}`); return null; }
};

let indexMemo: { at: number; v: UsaIndex | null } | null = null;
const INDEX_TTL = 10 * 60_000;
export async function usaIndex(): Promise<UsaIndex | null> {
  if (indexMemo && Date.now() - indexMemo.at < INDEX_TTL) return indexMemo.v;
  const b = await raw("osm/usa-index.json");
  let v: UsaIndex | null = null;
  try { v = b ? (JSON.parse(b.toString("utf8")) as UsaIndex) : null; } catch { v = null; }
  indexMemo = { at: Date.now(), v };
  return v;
}

// Parsed state files, kept per instance. Texas is large, so only a few stay.
const MAX_FILES = 10;
const files = new Map<string, Promise<StateFile | null>>();
export function stateFile(state: string, cat: string): Promise<StateFile | null> {
  if (!(STATE_SLUGS as readonly string[]).includes(state) || !/^[a-z_]+$/.test(cat)) return Promise.resolve(null);
  const key = `${state}/${cat}`;
  const hit = files.get(key);
  if (hit) return hit;
  const p = (async () => {
    const b = await raw(`osm/${state}/${cat}.json.gz`);
    if (!b) return null;
    try { return JSON.parse((await gunzipP(b)).toString("utf8")) as StateFile; }
    catch (e) { console.error(`[vend-usa] bad file ${key} ${errText(e)}`); return null; }
  })();
  files.set(key, p);
  p.then((v) => { if (!v) files.delete(key); }); // a miss is not remembered
  while (files.size > MAX_FILES) files.delete(files.keys().next().value as string);
  return p;
}
export const resetUsaMemo = () => { files.clear(); indexMemo = null; };

const overlap = (a: Bbox, b: Bbox) => Math.max(0, Math.min(a.north, b.north) - Math.max(a.south, b.south)) * Math.max(0, Math.min(a.east, b.east) - Math.max(a.west, b.west));

/** The states whose data could hold part of this place, best overlap first (the hinted state leads). At most four. */
export async function statesFor(b: Bbox, hint?: string | null): Promise<string[]> {
  const idx = await usaIndex();
  if (!idx) return [];
  const list = Object.entries(idx.states).filter(([, s]) => s.bounds && overlap(b, s.bounds) > 0).sort((x, y) => overlap(b, y[1].bounds!) - overlap(b, x[1].bounds!)).map(([k]) => k);
  if (hint && idx.states[hint] && !list.includes(hint)) list.unshift(hint);
  else if (hint && list.includes(hint)) list.splice(0, list.length, hint, ...list.filter((x) => x !== hint));
  return list.slice(0, 4);
}

/** One kind for a place, cut from the state files that touch it. Null when a needed state file is missing (the caller then falls back to Overpass). */
export async function cutUsa(cat: string, b: Bbox, states: string[]): Promise<{ items: OsmElement[]; fetchedAt: number } | null> {
  if (!states.length) return null;
  const seen = new Set<string>(), items: OsmElement[] = [];
  let fetchedAt = Infinity;
  for (const s of states) {
    const f = await stateFile(s, cat);
    if (!f) return null;
    fetchedAt = Math.min(fetchedAt, f.fetchedAt);
    for (const e of f.items) {
      if (e.lat < b.south || e.lat > b.north || e.lon < b.west || e.lon > b.east) continue;
      const k = `${e.type}${e.id}`;
      if (seen.has(k)) continue;
      seen.add(k); items.push(e);
    }
  }
  return { items, fetchedAt };
}
