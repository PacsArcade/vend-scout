import { cellToLatLng, getHexagonEdgeLengthAvg } from "h3-js";
import { cellCorners, cellOf } from "./areas";

// r23: every store and machine is drawn as the shape of its own grid cell, shrunk around the cell centre, so it nests
// inside the grid hexagon with the same corners and tilt at every zoom. Several things in one cell become one count hexagon.

/** How much of its grid cell a mark fills. */
export const MARK_SCALE = 0.56;

/** The corners of a cell, pulled in toward its centre by `scale`. Same corner order and tilt as the cell itself. */
export function innerHex(cell: string, scale = MARK_SCALE): [number, number][] {
  const [cl, co] = cellToLatLng(cell);
  return cellCorners(cell).map(([la, lo]) => [cl + (la - cl) * scale, co + (lo - co) * scale]);
}
/** The centre of a cell as [lat, lon]. */
export function cellCentre(cell: string): [number, number] { return cellToLatLng(cell) as [number, number]; }

/** Finest and coarsest grid the pins view uses. */
export const GRID_FINEST = 10, GRID_COARSEST = 5;
/** A grid cell must be at least this many screen pixels across, so the mark inside it (MARK_SCALE of it) is a 44 px tap target. */
export const MIN_CELL_PX = 80;
/** The finest resolution whose cells are at least `minPx` across at `metersPerPixel`. Replaces the r22 cell-count rule for the pins view,
 *  which on a phone made cells about 16 px wide: far too small to tap a mark inside. */
export function resForPixels(metersPerPixel: number, minPx = MIN_CELL_PX): number {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return 9;
  for (let r = GRID_FINEST; r > GRID_COARSEST; r--) if ((2 * getHexagonEdgeLengthAvg(r, "m")) / metersPerPixel >= minPx) return r;
  return GRID_COARSEST;
}

export interface Placed<K extends string = string> { kind: K; id: string; lat: number; lon: number }
export interface CellGroup<T> { cell: string; items: T[] }

/** Put each item in its cell at `res`. Items with no usable coordinate are skipped. Cells come back in a stable order. */
export function groupByCell<T extends { lat: number; lon: number }>(items: T[], res: number): CellGroup<T>[] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const c = cellOf(it.lat, it.lon, res);
    if (!c) continue;
    const a = m.get(c);
    if (a) a.push(it); else m.set(c, [it]);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cell, items]) => ({ cell, items }));
}
