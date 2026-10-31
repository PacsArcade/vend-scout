import { describe, expect, it } from "vitest";
import { haversineM, noMachineValue, openLateValue, scorePlace } from "./score";

describe("openLateValue", () => {
  it("24/7 is 100", () => expect(openLateValue("24/7").value).toBe(100));
  it("closes at 23:00 is 85", () => expect(openLateValue("Mo-Su 07:00-23:00").value).toBe(85));
  it("past midnight is 100", () => expect(openLateValue("Mo-Su 06:00-24:00").value).toBe(100));
  it("closes at 19:00 is low", () => expect(openLateValue("Mo-Sa 07:00-19:00").value).toBe(15));
  it("unknown is 40", () => expect(openLateValue(undefined).value).toBe(40));
});
describe("noMachineValue", () => {
  it("none nearby is 100", () => expect(noMachineValue(null).value).toBe(100));
  it("600 m is 100, 300 m is 50, 0 is 0", () => {
    expect(noMachineValue(600).value).toBe(100);
    expect(noMachineValue(300).value).toBe(50);
    expect(noMachineValue(0).value).toBe(0);
  });
});
describe("scorePlace", () => {
  it("is the weighted sum and explainable", () => {
    const r = scorePlace({ category: "laundry", openingHours: "24/7", nearestMachineM: 650 });
    expect(r.score).toBe(Math.round(95 * 0.4 + 100 * 0.25 + 100 * 0.35));
    expect(r.factors.reduce((a, f) => a + f.weight, 0)).toBeCloseTo(1);
  });
  it("a machine next door lowers the score", () => {
    const a = scorePlace({ category: "gym", openingHours: "24/7", nearestMachineM: 50 }).score;
    const b = scorePlace({ category: "gym", openingHours: "24/7", nearestMachineM: 600 }).score;
    expect(b).toBeGreaterThan(a);
  });
});
describe("haversineM", () => {
  it("about 111 km per degree of latitude", () => expect(Math.round(haversineM([41, -87], [42, -87]) / 1000)).toBe(111));
});
