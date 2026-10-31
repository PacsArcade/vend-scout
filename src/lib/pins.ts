import { placeProspects } from "./overpass";
import { checksWithStamps } from "./scoutcheck";
import type { VenueCategory } from "./types";

export interface Pin { id: string; name: string; area: string; lat: number; lon: number; category: VenueCategory; score: number; late: boolean; site: boolean; checked: boolean }

/** Everything the scout map needs for one place, read from the saved scans. No contacts. */
export async function buildPins(slug: string) {
  const checks = await checksWithStamps();
  const { list, machines } = await placeProspects(slug, checks);
  const pins: Pin[] = list.slice(0, 1500).map(({ prospect: p }) => ({ id: p.id, name: p.name, area: p.area, lat: p.lat, lon: p.lon, category: p.category, score: p.score, late: p.late, site: !!p.tags.website, checked: !!checks[p.id] }));
  const top20 = list.slice(0, 20).filter((x) => x.prospect.tags.website).map((x) => x.prospect.id);
  return { pins, machines, total: list.length, top20 };
}
