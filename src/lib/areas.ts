import { latLngToCell, cellToLatLng, gridDisk, cellToBoundary, polygonToCells, getHexagonAreaAvg } from "h3-js";

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

// ---- r22: the check-in zone and the cells the pages draw ----
/** The check-in zone is the machine's own cell and two rings around it: gridDisk k=2, 19 cells. Resolution 10 (edge about 66 m) makes the zone about 150 m out. */
export const CHECKIN_RES = 10;
export const CHECKIN_RINGS = 2;
export interface CheckInZone { center: string; cells: string[]; ring1: string[]; ring2: string[] }
/** The zone around a coordinate, or null when the coordinate is unusable. SHOWN on the job and machine pages; the app does not read the visitor's location, so it is not enforced. */
export function checkInZone(lat: unknown, lon: unknown): CheckInZone | null {
  const center = cellOf(lat, lon, CHECKIN_RES);
  if (!center) return null;
  const cells = gridDisk(center, CHECKIN_RINGS);
  const near = new Set(gridDisk(center, 1));
  return { center, cells, ring1: cells.filter((c) => c !== center && near.has(c)), ring2: cells.filter((c) => !near.has(c)) };
}
/** The six cells around a cell. */
export function ringOf(cell: string): string[] { return gridDisk(cell, 1).filter((c) => c !== cell); }
/** Corner points of a cell as [lat, lon] pairs. */
export function cellCorners(cell: string): [number, number][] { return cellToBoundary(cell) as [number, number][]; }
/** Cells that cover a view box at a resolution, or [] when that would be too many to draw. */
export function cellsInView(b: { s: number; w: number; n: number; e: number }, res: number, max = 900): string[] {
  const est = Math.abs(b.n - b.s) * 111 * Math.abs(b.e - b.w) * 111 * Math.cos(((b.n + b.s) / 2) * Math.PI / 180) / getHexagonAreaAvg(res, "km2");
  if (!Number.isFinite(est) || est > max) return [];
  const padLat = (b.n - b.s) * 0.08, padLon = (b.e - b.w) * 0.08;
  try { return polygonToCells([[b.s - padLat, b.w - padLon], [b.n + padLat, b.w - padLon], [b.n + padLat, b.e + padLon], [b.s - padLat, b.e + padLon]], res); } catch { return []; }
}
/** The finest resolution (10 down to 6) that keeps the cell count of a view under max. */
export function resForView(b: { s: number; w: number; n: number; e: number }, max = 700): number {
  for (let r = 10; r >= 6; r--) if (cellsInView(b, r, max).length > 0) return r;
  return 6;
}
