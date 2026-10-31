import { promises as fs } from "fs";
import path from "path";
import type { Bbox } from "./types";

// Our own OpenStreetMap copy, built on the house box by scripts/osm-build and kept in the repo under data-osm/ (ODbL data).
// Reading it needs no network and no storage, so it works the same on Vercel and at home.
const ROOT = path.join(process.cwd(), "data-osm");
export interface BundleMeta { extractedAt: number; extractedAtISO: string; md5?: string | null; counts: { illinois: Record<string, number>; cities: Record<string, Record<string, number>> } }
export interface BundleFile { v?: number; fetchedAt: number; items: import("./overpass").OsmElement[] }

const memo = new Map<string, unknown>();
async function readJson<T>(rel: string): Promise<T | null> {
  if (memo.has(rel)) return memo.get(rel) as T | null;
  let v: T | null = null;
  try { v = JSON.parse(await fs.readFile(path.join(ROOT, rel), "utf8")) as T; } catch { v = null; }
  memo.set(rel, v);
  return v;
}
export const bundleMeta = () => readJson<BundleMeta>("meta.json");
/** One of the nine built-in cities, for one kind. Null when there is no such file. */
export const bundledCity = (slug: string, cat: string) => (/^[a-z0-9-]+$/.test(slug) ? readJson<BundleFile>(`cities/${slug}/${cat}.json`) : Promise.resolve(null));
/** Every Illinois item of one kind, sorted by latitude. */
export const bundledState = (cat: string) => readJson<BundleFile>(`illinois/${cat}.json`);

/** Illinois, with a little slack. A place whose whole box is inside can be cut from the statewide files. */
export const IL_ENVELOPE: Bbox = { south: 36.9, west: -91.6, north: 42.6, east: -87.0 };
export const inIllinois = (b: Bbox) => b.south >= IL_ENVELOPE.south && b.north <= IL_ENVELOPE.north && b.west >= IL_ENVELOPE.west && b.east <= IL_ENVELOPE.east;

export async function cutState(cat: string, b: Bbox) {
  const f = await bundledState(cat);
  if (!f) return null;
  return f.items.filter((e) => e.lat >= b.south && e.lat <= b.north && e.lon >= b.west && e.lon <= b.east);
}
