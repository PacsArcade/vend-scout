import { promises as fs } from "fs";
import path from "path";
import { distM, scorePlace, latestClose } from "./score";
import type { Bbox, Category, Place, Prospect, Scored, ScoredProspect } from "./types";
import { ALL_CATEGORIES, CATEGORY_LABEL, VENUE_CATEGORIES } from "./types";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const UA = "VendScout/0.2 (local prototype; pac@pacsarcade.org)";
const CACHE_ROOT = path.join(process.cwd(), "data", "cache");
const DAY = 24 * 60 * 60 * 1000;

const FILTER: Record<Category, string> = {
  laundry: "shop=laundry",
  gym: "leisure=fitness_centre",
  car_wash: "amenity=car_wash",
  car_repair: "shop=car_repair",
  vending: "amenity=vending_machine",
  convenience: "shop=convenience",
  fast_food: "amenity=fast_food",
};

export interface OsmElement { id: number; type: string; lat: number; lon: number; name?: string; opening_hours?: string; street?: string }
interface CacheFile { fetchedAt: number; items: OsmElement[] }

const file = (slug: string, c: Category) => path.join(CACHE_ROOT, slug, `overpass-${c}.json`);

export async function readCache(slug: string, c: Category): Promise<CacheFile | null> {
  try {
    return JSON.parse(await fs.readFile(file(slug, c), "utf8")) as CacheFile;
  } catch {
    return null;
  }
}

async function liveQuery(c: Category, b: Bbox): Promise<OsmElement[]> {
  const q = `[out:json][timeout:60];nwr[${FILTER[c]}](${b.south},${b.west},${b.north},${b.east});out center tags;`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as { elements: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  return json.elements
    .map((e): OsmElement | null => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat === undefined || lon === undefined) return null;
      const t = e.tags ?? {};
      const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
      return { id: e.id, type: e.type, lat, lon, name: t.name, opening_hours: t.opening_hours, street: street || undefined };
    })
    .filter((x): x is OsmElement => x !== null);
}

/** Cached items. Goes live only when allowed and the cache is missing or older than a day (one live query per category per day). */
export async function getCategory(place: Place, c: Category, allowLive: boolean) {
  const cached = await readCache(place.slug, c);
  const fresh = cached && Date.now() - cached.fetchedAt < DAY;
  if (fresh || !allowLive) return { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? null, live: false, error: undefined as string | undefined };
  try {
    const items = await liveQuery(c, place.bbox);
    await fs.mkdir(path.join(CACHE_ROOT, place.slug), { recursive: true });
    const data: CacheFile = { fetchedAt: Date.now(), items };
    await fs.writeFile(file(place.slug, c), JSON.stringify(data));
    return { items, fetchedAt: data.fetchedAt, live: false || true, error: undefined as string | undefined };
  } catch (e) {
    return { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? null, live: false, error: String(e) };
  }
}

export async function cacheCounts(slug: string) {
  const out: Record<string, number | null> = {};
  for (const c of ALL_CATEGORIES) out[c] = (await readCache(slug, c))?.items.length ?? null;
  return out;
}

export interface Detailed { prospect: ScoredProspect; scored: Scored }

export async function placeProspects(slug: string): Promise<{ list: Detailed[]; machines: { lat: number; lon: number }[] }> {
  const read = async (c: Category) => (await readCache(slug, c))?.items ?? [];
  const machines = await read("vending");
  const food = [...(await read("convenience")), ...(await read("fast_food"))];
  const venues = new Map<string, OsmElement[]>();
  for (const c of VENUE_CATEGORIES) venues.set(c, await read(c));
  const list: Detailed[] = [];
  for (const c of VENUE_CATEGORIES) {
    const items = venues.get(c) ?? [];
    for (const e of items) {
      const pt: [number, number] = [e.lat, e.lon];
      let nearest: number | null = null;
      for (const m of machines) {
        const d = distM(pt, [m.lat, m.lon]);
        if (nearest === null || d < nearest) nearest = d;
      }
      let same = 0;
      for (const o of items) if (o !== e && Math.abs(o.lat - e.lat) < 0.005 && distM(pt, [o.lat, o.lon]) <= 400) same++;
      let foodLate = 0;
      for (const f of food) {
        if (Math.abs(f.lat - e.lat) > 0.005) continue;
        if (distM(pt, [f.lat, f.lon]) > 400) continue;
        const close = latestClose(f.opening_hours);
        foodLate += close === null ? 0.5 : close >= 22 * 60 ? 1 : 0;
      }
      const scored = scorePlace({ category: c, openingHours: e.opening_hours, hasName: !!e.name, hasAddress: !!e.street, nearestMachineM: nearest, sameNear: same, foodLateNear: foodLate });
      const p: Prospect = {
        id: `osm-${e.type[0]}${e.id}`,
        name: e.name ?? `${CATEGORY_LABEL[c]} (unnamed)`,
        area: e.street ?? "No address on the map",
        lat: e.lat, lon: e.lon, category: c, openingHours: e.opening_hours, placeSlug: slug,
      };
      const late = (latestClose(e.opening_hours) ?? 0) >= 22 * 60;
      list.push({ prospect: { ...p, score: scored.score, late }, scored });
    }
  }
  list.sort((a, b) => b.prospect.score - a.prospect.score);
  return { list, machines };
}

export async function findProspect(id: string): Promise<Detailed | null> {
  let dirs: string[] = [];
  try { dirs = await fs.readdir(CACHE_ROOT); } catch { return null; }
  for (const d of dirs) {
    if (d.endsWith(".json")) continue;
    const { list } = await placeProspects(d);
    const hit = list.find((x) => x.prospect.id === id);
    if (hit) return hit;
  }
  return null;
}
