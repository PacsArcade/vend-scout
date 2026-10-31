import { promises as fs } from "fs";
import path from "path";
import type { Bbox, Place } from "./types";

const DIR = path.join(process.cwd(), "data", "cache");
const FILE = path.join(DIR, "places.json");
const UA = "VendScout/0.2 (local prototype; pac@pacsarcade.org)";

export const CHICAGO: Place = { slug: "chicago", name: "Chicago, Illinois, United States", bbox: { south: 41.64, west: -87.94, north: 42.03, east: -87.52 } };

type Store = Record<string, Place>; // by slug
type Queries = Record<string, string>; // query -> slug
interface File { places: Store; queries: Queries }

async function read(): Promise<File> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as File;
  } catch {
    return { places: {}, queries: {} };
  }
}
export async function getPlace(slug: string): Promise<Place | null> {
  if (slug === "chicago") return CHICAGO;
  return (await read()).places[slug] ?? null;
}
export async function listPlaces(): Promise<Place[]> {
  return [CHICAGO, ...Object.values((await read()).places)];
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "place";

/** Keep very large boxes (a whole country) to something Overpass will answer. */
export function clampBbox(b: Bbox, maxSpan = 0.5): Bbox {
  const cLat = (b.south + b.north) / 2, cLon = (b.west + b.east) / 2;
  const half = maxSpan / 2;
  return {
    south: Math.max(b.south, cLat - half), north: Math.min(b.north, cLat + half),
    west: Math.max(b.west, cLon - half), east: Math.min(b.east, cLon + half),
  };
}

let last = 0;
/** Nominatim: one request per second at most, answers cached on disk. */
export async function searchPlace(q: string): Promise<Place | null> {
  const key = q.trim().toLowerCase();
  if (!key) return null;
  const f = await read();
  const hit = f.queries[key];
  if (hit && (hit === "chicago" || f.places[hit])) return await getPlace(hit);
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const j = (await res.json()) as { display_name: string; boundingbox: string[] }[];
  if (!j.length) return null;
  const [s, n, w, e] = j[0].boundingbox.map(Number);
  const place: Place = { slug: slugify(j[0].display_name), name: j[0].display_name, bbox: clampBbox({ south: s, north: n, west: w, east: e }) };
  if (place.slug === "chicago-illinois-united-states" || place.slug.startsWith("chicago-cook")) place.slug = "chicago";
  if (place.slug !== "chicago") f.places[place.slug] = place;
  f.queries[key] = place.slug;
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(f));
  return place.slug === "chicago" ? CHICAGO : place;
}
