import { readText, writeText } from "./blobstore";
import { listPlaces } from "./places";
import { distM, scorePlace, latestClose } from "./score";
import type { Bbox, Category, OsmContactTags, Place, Prospect, Scored, ScoredProspect } from "./types";
import { ALL_CATEGORIES, CATEGORY_LABEL, VENUE_CATEGORIES } from "./types";

// The public server is shared and often busy. Try it first, then a second public mirror.
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const UA = "VendScout/0.2 (Pac's Arcade, pac@pacsarcade.org)";
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

export interface OsmElement { id: number; type: string; lat: number; lon: number; name?: string; opening_hours?: string; street?: string; tags?: OsmContactTags }
// v2 adds contact tags. A v1 file still reads, but counts as stale so the next scan refreshes it.
const SCHEMA = 2;
interface CacheFile { v?: number; fetchedAt: number; items: OsmElement[] }

const file = (slug: string, c: Category) => `cache/${slug}/overpass-${c}.json`;

export async function readCache(slug: string, c: Category): Promise<CacheFile | null> {
  try {
    return JSON.parse((await readText(file(slug, c))) ?? "") as CacheFile;
  } catch {
    return null;
  }
}

async function liveQuery(c: Category, b: Bbox): Promise<OsmElement[]> {
  const q = `[out:json][timeout:60];nwr[${FILTER[c]}](${b.south},${b.west},${b.north},${b.east});out center tags;`;
  let last = "OpenStreetMap did not answer";
  let res: Response | null = null;
  type Body = { remark?: string; elements: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  let body: Body | null = null;
  for (const endpoint of ENDPOINTS) {
    try {
      res = await fetch(endpoint, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(65_000) });
      if (res.status === 429 || res.status >= 500) { last = res.status === 429 ? "The map server is busy" : "The map server had a problem"; continue; }
      if (!res.ok) { last = `The map server refused the request (${res.status})`; continue; }
      const j = (await res.json()) as Body;
      // Overpass answers 200 with a remark when the query ran out of time or memory. That result is partial, so it must not be cached.
      if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark)) { last = "The map server ran out of time on this area"; continue; }
      body = j;
      break;
    } catch (e) {
      last = (e as Error).name === "TimeoutError" ? "The map server took too long" : "Could not reach the map server";
    }
  }
  if (!body) throw new Error(last);
  const json = body;
  return json.elements
    .map((e): OsmElement | null => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat === undefined || lon === undefined) return null;
      const t = e.tags ?? {};
      const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
      const tags: OsmContactTags = {
        phone: t.phone ?? t["contact:phone"] ?? t["contact:mobile"],
        email: t.email ?? t["contact:email"],
        website: t.website ?? t["contact:website"] ?? t.url,
        facebook: t["contact:facebook"] ?? t.facebook,
        instagram: t["contact:instagram"] ?? t.instagram,
      };
      return { id: e.id, type: e.type, lat, lon, name: t.name, opening_hours: t.opening_hours, street: street || undefined, tags };
    })
    .filter((x): x is OsmElement => x !== null);
}

/** Cached items. Goes live only when allowed and the cache is missing or older than a day (one live query per category per day). */
export async function getCategory(place: Place, c: Category, allowLive: boolean) {
  const cached = await readCache(place.slug, c);
  const fresh = cached && (cached.v ?? 1) >= SCHEMA && Date.now() - cached.fetchedAt < DAY;
  if (fresh || !allowLive) return { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? null, live: false, error: undefined as string | undefined };
  try {
    const items = await liveQuery(c, place.bbox);
    const data: CacheFile = { v: SCHEMA, fetchedAt: Date.now(), items };
    await writeText(file(place.slug, c), JSON.stringify(data));
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
        lat: e.lat, lon: e.lon, category: c, openingHours: e.opening_hours, placeSlug: slug, tags: e.tags ?? {},
      };
      const late = (latestClose(e.opening_hours) ?? 0) >= 22 * 60;
      list.push({ prospect: { ...p, score: scored.score, late }, scored });
    }
  }
  list.sort((a, b) => b.prospect.score - a.prospect.score);
  return { list, machines };
}

export async function findProspect(id: string): Promise<Detailed | null> {
  for (const pl of await listPlaces()) {
    const { list } = await placeProspects(pl.slug);
    const hit = list.find((x) => x.prospect.id === id);
    if (hit) return hit;
  }
  return null;
}
