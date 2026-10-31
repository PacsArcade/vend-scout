import { describe, expect, it } from "vitest";
import { densityValue, distM, foodValue, haversineM, noMachineValue, openLateValue, scorePlace, completeValue } from "./score";

describe("openLateValue", () => {
  it("24/7 is 100", () => expect(openLateValue("24/7").value).toBe(100));
  it("closes at 23:00 is 80", () => expect(openLateValue("Mo-Su 07:00-23:00").value).toBe(80));
  it("past midnight is 100", () => expect(openLateValue("Mo-Su 06:00-24:00").value).toBe(100));
  it("closes at 19:00 is low", () => expect(openLateValue("Mo-Sa 07:00-19:00").value).toBe(10));
  it("unknown hours earn nothing", () => expect(openLateValue(undefined).value).toBe(0));
});
describe("noMachineValue", () => {
  it("none mapped is 100", () => expect(noMachineValue(null).value).toBe(100));
  it("scales to 1000 m", () => {
    expect(noMachineValue(1000).value).toBe(100);
    expect(noMachineValue(500).value).toBe(50);
    expect(noMachineValue(0).value).toBe(0);
  });
});
describe("density, food, completeness", () => {
  it("more of the same kind nearby lowers the value", () => {
    expect(densityValue(0, "laundry").value).toBe(100);
    expect(densityValue(2, "laundry").value).toBe(50);
    expect(densityValue(9, "laundry").value).toBe(0);
  });
  it("late food nearby lowers the value", () => {
    expect(foodValue(0).value).toBe(100);
    expect(foodValue(1).value).toBeLessThan(foodValue(0).value);
    expect(foodValue(3).value).toBeLessThan(foodValue(1).value);
  });
  it("completeness counts name, hours, address", () => {
    expect(completeValue(true, "24/7", true).value).toBe(100);
    expect(completeValue(false, undefined, false).value).toBe(0);
  });
});
describe("scorePlace", () => {
  const base = { category: "laundry" as const, openingHours: "24/7", hasName: true, hasAddress: true, nearestMachineM: 1200, sameNear: 0, foodLateNear: 0 };
  it("weights add to one and the score is the weighted sum", () => {
    const r = scorePlace(base);
    expect(r.factors.reduce((a, f) => a + f.weight, 0)).toBeCloseTo(1);
    expect(r.score).toBe(Math.round(95 * 0.2 + 100 * 0.2 + 100 * 0.2 + 100 * 0.1 + 100 * 0.2 + 100 * 0.1));
  });
  it("spreads: a crowded, bare, close-to-a-machine place scores far lower", () => {
    const bad = scorePlace({ ...base, openingHours: undefined, hasName: false, hasAddress: false, nearestMachineM: 60, sameNear: 4, foodLateNear: 3 }).score;
    expect(scorePlace(base).score - bad).toBeGreaterThan(45);
  });
});
describe("distance", () => {
  it("about 111 km per degree of latitude", () => {
    expect(Math.round(haversineM([41, -87], [42, -87]) / 1000)).toBe(111);
    expect(Math.round(distM([41, -87], [42, -87]) / 1000)).toBe(111);
  });
});
