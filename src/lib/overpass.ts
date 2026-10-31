import { promises as fs } from "fs";
import path from "path";
import { haversineM, scorePlace } from "./score";
import type { Category, Prospect } from "./types";
import { CATEGORIES } from "./types";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const UA = "VendScout/0.1 (local prototype; pac@pacsarcade.org)";
const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const DAY = 24 * 60 * 60 * 1000;

const FILTER: Record<Category, string> = {
  laundry: "shop=laundry",
  gym: "leisure=fitness_centre",
  car_wash: "amenity=car_wash",
  car_repair: "shop=car_repair",
  vending: "amenity=vending_machine",
};

export interface OsmElement { id: number; type: string; lat: number; lon: number; name?: string; opening_hours?: string; street?: string }
interface CacheFile { fetchedAt: number; items: OsmElement[] }

const file = (c: Category) => path.join(CACHE_DIR, `overpass-${c}.json`);

export async function readCache(c: Category): Promise<CacheFile | null> {
  try {
    return JSON.parse(await fs.readFile(file(c), "utf8")) as CacheFile;
  } catch {
    return null;
  }
}

async function liveQuery(c: Category): Promise<OsmElement[]> {
  const q = `[out:json][timeout:60];area["name"="Chicago"]["boundary"="administrative"]->.a;nwr[${FILTER[c]}](area.a);out center tags;`;
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
      const el: OsmElement = { id: e.id, type: e.type, lat, lon, name: t.name, opening_hours: t.opening_hours, street: street || undefined };
      return el;
    })
    .filter((x): x is OsmElement => x !== null);
}

/** Returns cached items. Goes live only if the cache is older than a day (or missing) and refresh is allowed. */
export async function getCategory(c: Category, allowLive: boolean): Promise<{ items: OsmElement[]; fetchedAt: number | null; live: boolean; error?: string }> {
  const cached = await readCache(c);
  const fresh = cached && Date.now() - cached.fetchedAt < DAY;
  if (fresh || !allowLive) return { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? null, live: false };
  try {
    const items = await liveQuery(c);
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const data: CacheFile = { fetchedAt: Date.now(), items };
    await fs.writeFile(file(c), JSON.stringify(data));
    return { items, fetchedAt: data.fetchedAt, live: true };
  } catch (e) {
    return { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? null, live: false, error: String(e) };
  }
}

export async function osmProspects(limit = 400): Promise<{ prospects: (Prospect & { score: number })[]; machines: { lat: number; lon: number }[] }> {
  const machines = (await readCache("vending"))?.items ?? [];
  const out: (Prospect & { score: number })[] = [];
  for (const c of CATEGORIES) {
    if (c === "vending") continue;
    const cache = await readCache(c);
    for (const e of cache?.items ?? []) {
      let nearest: number | null = null;
      for (const m of machines) {
        const d = haversineM([e.lat, e.lon], [m.lat, m.lon]);
        if (nearest === null || d < nearest) nearest = d;
      }
      const p: Prospect = {
        id: `osm-${e.type[0]}${e.id}`,
        name: e.name ?? `${c === "laundry" ? "Laundromat" : c === "gym" ? "Gym" : c === "car_wash" ? "Car wash" : "Auto shop"} (unnamed)`,
        area: e.street ?? "Chicago",
        lat: e.lat,
        lon: e.lon,
        category: c,
        openingHours: e.opening_hours,
        nearestMachineM: nearest,
        why: "From OpenStreetMap. Not visited yet.",
        stage: "Found",
        source: "osm",
      };
      out.push({ ...p, score: scorePlace(p).score });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return { prospects: out.slice(0, limit), machines };
}
