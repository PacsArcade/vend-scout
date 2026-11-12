import { latLngToCell, cellToLatLng } from "h3-js";

// Service areas on an H3 grid. Pure library: no network, no map tiles.
// Resolution 7: a cell is about 5 square km (edge about 1.2 km), roughly a neighbourhood.
// That is coarse enough that a cell never points at a street address, and fine enough to tell two parts of a city apart.
export const AREA_RES = 7;

export interface Point { lat?: number; lon?: number; kind: "job" | "machine" }
export interface AreaCell { cell: string; jobs: number; machines: number; lat: number; lon: number }

const valid = (lat: unknown, lon: unknown): lat is number => typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** The cell for a coordinate, or null when the coordinate is missing or out of range. */
export function cellOf(lat: unknown, lon: unknown, res = AREA_RES): string | null {
  if (!valid(lat, lon)) return null;
  try { return latLngToCell(lat, lon as number, res); } catch { return null; }
}
/** Count jobs and machines per cell. Points with no usable coordinate are skipped. Busiest cell first. */
export function countByCell(points: Point[], res = AREA_RES): AreaCell[] {
  const m = new Map<string, AreaCell>();
  for (const p of points) {
    const c = cellOf(p.lat, p.lon, res);
    if (!c) continue;
    let e = m.get(c);
    if (!e) { const [lat, lon] = cellToLatLng(c); e = { cell: c, jobs: 0, machines: 0, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 }; m.set(c, e); }
    if (p.kind === "job") e.jobs++; else e.machines++;
  }
  return [...m.values()].sort((a, b) => b.jobs + b.machines - (a.jobs + a.machines) || a.cell.localeCompare(b.cell));
}
