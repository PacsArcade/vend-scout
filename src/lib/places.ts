import { readText, writeText } from "./blobstore";
import type { Bbox, Place } from "./types";

const FILE = "cache/places.json";
const UA = "VendScout/0.2 (Pac's Arcade, pac@pacsarcade.org)";

export const CHICAGO: Place = { slug: "chicago", name: "Chicago, Illinois, United States", bbox: { south: 41.64, west: -87.94, north: 42.03, east: -87.52 } };

type Store = Record<string, Place>; // by slug
type Queries = Record<string, string>; // query -> slug
interface File { places: Store; queries: Queries }

async function read(): Promise<File> {
  try {
    return JSON.parse((await readText(FILE)) ?? "") as File;
  } catch {
    return { places: {}, queries: {} };
  }
}
export async function getPlace(slug: string): Promise<Place | null> {
  if (slug === "chicago") return CHICAGO;
  const il = IL_CITIES.find((c) => c.slug === slug);
  if (il) return il;
  return (await read()).places[slug] ?? null;
}
export async function listPlaces(): Promise<Place[]> {
  return [CHICAGO, ...IL_CITIES, ...Object.values((await read()).places)];
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
  await writeText(FILE, JSON.stringify(f));
  return place.slug === "chicago" ? CHICAGO : place;
}

// Illinois. Chicago is first and the default. These are fixed boxes (about 0.2 degrees), so no lookup is needed to scan them.
const box = (lat: number, lon: number, d = 0.1): Bbox => ({ south: lat - d, north: lat + d, west: lon - d * 1.3, east: lon + d * 1.3 });
export const IL_CITIES: Place[] = [
  { slug: "aurora-il", name: "Aurora, Illinois", bbox: box(41.7606, -88.3201) },
  { slug: "naperville-il", name: "Naperville, Illinois", bbox: box(41.7508, -88.1535) },
  { slug: "joliet-il", name: "Joliet, Illinois", bbox: box(41.525, -88.0817) },
  { slug: "rockford-il", name: "Rockford, Illinois", bbox: box(42.2711, -89.094) },
  { slug: "springfield-il", name: "Springfield, Illinois", bbox: box(39.7817, -89.6501) },
  { slug: "peoria-il", name: "Peoria, Illinois", bbox: box(40.6936, -89.589) },
  { slug: "elgin-il", name: "Elgin, Illinois", bbox: box(42.0354, -88.2826) },
  { slug: "champaign-il", name: "Champaign, Illinois", bbox: box(40.1164, -88.2434) },
];
export const ILLINOIS: Place[] = [CHICAGO, ...IL_CITIES];
export const cityCenter = (p: Place): [number, number] => [(p.bbox.south + p.bbox.north) / 2, (p.bbox.west + p.bbox.east) / 2];
