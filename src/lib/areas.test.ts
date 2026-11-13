import { describe, expect, it } from "vitest";
import { AREA_RES, cellOf, countByCell } from "./areas";

describe("H3 areas", () => {
  it("maps a coordinate to a res 7 cell and is stable", () => {
    const c = cellOf(41.8201, -87.6853)!;
    expect(c).toMatch(/^87[0-9a-f]{13}$/); // res 7 cells start with 87
    expect(AREA_RES).toBe(7);
    expect(cellOf(41.8201, -87.6853)).toBe(c);
  });
  it("gives the same cell to two nearby points and a different one far away", () => {
    expect(cellOf(41.8201, -87.6853)).toBe(cellOf(41.8205, -87.6850));
    expect(cellOf(41.8201, -87.6853)).not.toBe(cellOf(40.7128, -74.006));
  });
  it("returns null for missing or out-of-range coordinates", () => {
    expect(cellOf(undefined, undefined)).toBeNull(); expect(cellOf(95, 0)).toBeNull(); expect(cellOf(NaN, 0)).toBeNull(); expect(cellOf("1", 2)).toBeNull();
  });
  it("counts jobs and machines per cell, busiest first, skipping points with no place", () => {
    const out = countByCell([
      { lat: 41.8201, lon: -87.6853, kind: "job" }, { lat: 41.8203, lon: -87.6851, kind: "job" }, { lat: 41.8202, lon: -87.6852, kind: "machine" },
      { lat: 40.7128, lon: -74.006, kind: "machine" }, { kind: "job" },
    ]);
    expect(out.length).toBe(2);
    expect(out[0]).toMatchObject({ jobs: 2, machines: 1 });
    expect(out[1]).toMatchObject({ jobs: 0, machines: 1 });
    expect(out[0].lat).toBeCloseTo(41.82, 1);
  });
  it("is empty for no points", () => { expect(countByCell([])).toEqual([]); });
});
