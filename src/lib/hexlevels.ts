import { cellToCenterChild, cellToChildren, cellToLatLng, getResolution } from "h3-js";
import { cellCorners } from "./areas";
import { GRID_FINEST } from "./hexcells";

// r26, hexagon round 3 (card 04 A, card 02 A). Three views of the pins map, by how fine the grid is:
//   "building": the finest grid. Every store and machine stands on its real spot; marks too close for a thumb fan out on spider lines.
//   "levels":   one level out. Each bold border is a parent cell; seven small hexagons sit WHOLE inside it, each a little smaller
//               than the true child cell, with small gaps along the border. A thing alone keeps its real spot; several are a count
//               in the middle of their small hexagon.
//   "cells":    further out. Unchanged from r23/r24: marks shrunk around the cell centre, counts in the middle.
// The true grid cannot put seven whole cells inside one bigger cell (they are turned about 19 degrees and poke out), so the
// small hexagons here are drawn, not the true child cells. Each still stands for its true child cell: what lies in that cell is
// what the small hexagon counts.

export type MapLevel = "building" | "levels" | "cells";
export function levelFor(gridRes: number): MapLevel {
  return gridRes >= GRID_FINEST ? "building" : gridRes === GRID_FINEST - 1 ? "levels" : "cells";
}

type LL = [number, number];
/** The fitted size, card 02's numbers: a small hexagon's corner radius is FIT_R of the bold border's. The true child is 1/sqrt(7) = 0.378. */
export const FIT_R = 0.325;
/** How far from the border's centre the six outer small hexagons sit, as a share of the border's corner radius. sqrt(3) x FIT_R, so neighbours share an edge. */
export const FIT_D = Math.sqrt(3) * FIT_R;

export interface FittedChild {
  /** The true H3 child cell this small hexagon stands for. */
  cell: string;
  /** 0 is the middle one; 1 to 6 sit toward the border's corners. */
  slot: number;
  centre: LL;
  corners: LL[];
}

/**
 * The seven small hexagons drawn whole inside a parent cell. Built from the parent's own corners, so they follow its tilt and its
 * slight H3 distortion: the middle one sits on the parent's centre, the others toward each corner, turned 30 degrees to the parent.
 * Each true child is matched to the slot nearest its own centre. Empty for a pentagon (never in the United States).
 */
export function fittedChildren(parent: string, childRes?: number): FittedChild[] {
  const P = cellCorners(parent);
  if (P.length !== 6) return [];
  const [cl, co] = cellToLatLng(parent);
  const kx = Math.cos((cl * Math.PI) / 180);
  const v = P.map(([la, lo]) => [la - cl, lo - co] as LL);
  const res = childRes ?? getResolution(parent) + 1;
  const kids = cellToChildren(parent, res);
  if (kids.length !== 7) return [];
  const mid = cellToCenterChild(parent, res);
  // slot centres: the middle, then toward corner k
  const centres: LL[] = [[cl, co], ...v.map(([a, b]) => [cl + FIT_D * a, co + FIT_D * b] as LL)];
  // a small hexagon's corners point between two of the parent's corners (30 degrees turned); |v_j + v_j+1| = sqrt(3) x R
  const shape = v.map((_, j) => { const n = v[(j + 1) % 6]; return [(FIT_R / Math.sqrt(3)) * (v[j][0] + n[0]), (FIT_R / Math.sqrt(3)) * (v[j][1] + n[1])] as LL; });
  const free = new Set([1, 2, 3, 4, 5, 6]);
  const out: FittedChild[] = [];
  const angle = ([a, b]: LL) => Math.atan2(a, b * kx);
  for (const c of kids) {
    let slot = 0;
    if (c !== mid) {
      const [la, lo] = cellToLatLng(c);
      const a = angle([la - cl, lo - co]);
      let best = Infinity;
      for (const s of free) { const d = Math.abs(Math.atan2(Math.sin(a - angle(v[s - 1])), Math.cos(a - angle(v[s - 1])))); if (d < best) { best = d; slot = s; } }
      free.delete(slot);
    }
    const [x, y] = centres[slot];
    out.push({ cell: c, slot, centre: [x, y], corners: shape.map(([a, b]) => [x + a, y + b] as LL) });
  }
  return out.sort((a, b) => a.slot - b.slot);
}
/** A small hexagon pulled in toward its centre, for a count mark. */
export function shrink(corners: LL[], centre: LL, k: number): LL[] {
  return corners.map(([a, b]) => [centre[0] + (a - centre[0]) * k, centre[1] + (b - centre[1]) * k] as LL);
}

// ---- fanning out: marks closer than a thumb ----
/** A mark on the screen is this wide; marks whose centres are closer than FAN_GAP fan out. 44 px is the tap target, plus a little air. */
export const MARK_PX = 44, FAN_GAP = 50;
export interface Pt { x: number; y: number }
/**
 * Spread screen points so no two marks sit closer than `gap`. Points already far enough apart stay put (they stand on their real spot).
 * A group of near points moves onto a ring around the group's middle, in the order they lie around it, so the spider lines do not cross.
 * Returns one position per input, and the group each belongs to (size 1 means it did not move).
 */
export function fanOut(pts: Pt[], gap = FAN_GAP): { at: Pt; group: number; size: number }[] {
  const n = pts.length, up = pts.map((_, i) => i);
  const find = (i: number): number => (up[i] === i ? i : (up[i] = find(up[i])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < gap) up[find(i)] = find(j);
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); }
  const out: { at: Pt; group: number; size: number }[] = pts.map((p) => ({ at: p, group: -1, size: 1 }));
  let g = 0;
  for (const idx of groups.values()) {
    const id = g++;
    if (idx.length === 1) { out[idx[0]] = { at: pts[idx[0]], group: id, size: 1 }; continue; }
    const cx = idx.reduce((a, i) => a + pts[i].x, 0) / idx.length, cy = idx.reduce((a, i) => a + pts[i].y, 0) / idx.length;
    const k = idx.length;
    // the ring: neighbours on it are `gap` apart, and it is never smaller than one gap
    const rad = Math.max(gap, gap / (2 * Math.sin(Math.PI / k)));
    const order = [...idx].sort((a, b) => Math.atan2(pts[a].y - cy, pts[a].x - cx) - Math.atan2(pts[b].y - cy, pts[b].x - cx));
    // start the ring where the first point already leans, so marks move as little as they can
    const a0 = Math.atan2(pts[order[0]].y - cy, pts[order[0]].x - cx) || -Math.PI / 2;
    order.forEach((i, s) => { const a = a0 + (2 * Math.PI * s) / k; out[i] = { at: { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) }, group: id, size: k }; });
  }
  return out;
}
