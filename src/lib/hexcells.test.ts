import { describe, expect, it } from "vitest";
import { cellToLatLng, isPointInPolygon } from "./hexcells.testutil";
import { cellCorners, cellOf } from "./areas";
import { getHexagonEdgeLengthAvg } from "h3-js";
import { groupByCell, innerHex, MARK_SCALE, MIN_CELL_PX, resForPixels } from "./hexcells";

describe("r23 hexagons inside the grid", () => {
  for (const res of [7, 9, 10]) {
    it(`keeps the cell's corners and tilt at res ${res}, scaled about the centre`, () => {
      const c = cellOf(41.9284, -87.7071, res)!;
      const outer = cellCorners(c), inner = innerHex(c);
      const [cl, co] = cellToLatLng(c);
      expect(inner).toHaveLength(outer.length);
      inner.forEach(([la, lo], i) => {
        // each inner corner lies on the line from the centre to the matching outer corner, at MARK_SCALE of the way
        expect(la - cl).toBeCloseTo((outer[i][0] - cl) * MARK_SCALE, 12);
        expect(lo - co).toBeCloseTo((outer[i][1] - co) * MARK_SCALE, 12);
        expect(isPointInPolygon([la, lo], outer)).toBe(true);
      });
    });
  }
  it("puts nearby things in one cell and far things apart, skipping bad coordinates", () => {
    const g = groupByCell([
      { id: "a", lat: 41.8201, lon: -87.6853 },
      { id: "b", lat: 41.8202, lon: -87.6852 },
      { id: "c", lat: 41.95, lon: -87.75 },
      { id: "x", lat: Number.NaN, lon: 0 },
    ], 8);
    expect(g).toHaveLength(2);
    const sizes = g.map((x) => x.items.length).sort();
    expect(sizes).toEqual([1, 2]);
    expect(g.flatMap((x) => x.items.map((i) => i.id))).not.toContain("x");
  });
  it("picks a grid whose marks are big enough to tap", () => {
    // Chicago, Leaflet zoom 17, 15 and 11: about 0.89, 3.6 and 57 metres per screen pixel
    for (const mpp of [0.89, 3.6, 57]) {
      const r = resForPixels(mpp);
      const px = (2 * getHexagonEdgeLengthAvg(r, "m")) / mpp;
      expect(px * MARK_SCALE).toBeGreaterThanOrEqual(44);
      if (r < 10) expect((2 * getHexagonEdgeLengthAvg(r + 1, "m")) / mpp).toBeLessThan(MIN_CELL_PX); // and it is the finest such grid
    }
    expect(resForPixels(0.89)).toBe(10);
    expect(resForPixels(3.6)).toBe(9);
    expect(resForPixels(Number.NaN)).toBe(9);
  });
  it("splits a group as the grid gets finer", () => {
    const pts = [{ lat: 41.8201, lon: -87.6853 }, { lat: 41.8231, lon: -87.6813 }];
    expect(groupByCell(pts, 6)).toHaveLength(1);
    expect(groupByCell(pts, 10)).toHaveLength(2);
  });
});
