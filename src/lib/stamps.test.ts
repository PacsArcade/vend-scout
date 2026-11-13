import { describe, expect, it } from "vitest";
import { isMilestoneVisit, nextMilestone, streakTier, visitStamps } from "./stamps";
import type { PassportEvent } from "./passport";
const ev = (i: number, kind: PassportEvent["kind"] = "restock"): PassportEvent => ({ at: `2026-01-${String(i + 1).padStart(2, "0")}`, kind, text: "x" });
describe("stamp rarity", () => {
  it("A: milestones at 1, 21, 100", () => { expect([1, 2, 21, 22, 100].map(isMilestoneVisit)).toEqual([true, false, true, false, true]); expect(nextMilestone(21)).toBe(100); });
  it("B: bronze 3, silver 7, gold 21", () => { expect([2, 3, 6, 7, 20, 21].map(streakTier)).toEqual([null, "bronze", "bronze", "silver", "silver", "gold"]); });
  it("counts only restocks and stops, in order", () => {
    const v = visitStamps([ev(0), ev(1, "proof"), ev(2, "stop"), ev(3, "sale")]);
    expect(v.map((x) => x.n)).toEqual([1, 2]);
    expect(v[0].milestone).toBe(true);
  });
  it("unknown timing neither counts nor breaks a streak", () => { expect(visitStamps([ev(0), ev(1), ev(2)]).every((x) => x.tier === null && x.onTime === null)).toBe(true); });
  it("a late visit starts the count again", () => {
    const flags = [true, true, true, false, true];
    const v = visitStamps(flags.map((_, i) => ev(i)), (e) => flags[Number(e.at.slice(-2)) - 1]);
    expect(v.map((x) => x.tier)).toEqual([null, null, "bronze", null, null]);
    expect(v[4].run).toBe(1);
  });
});

import { salesPerWeek } from "./weekly";
describe("sales per week", () => {
  it("counts per block-week and marks the running one", () => {
    const w = salesPerWeek([{ h: 1008 * 30 + 1 }, { h: 1008 * 30 + 5 }, { h: 1008 * 31 + 2 }, { h: 5, test: true }], 3);
    expect(w.map((x) => x.count)).toEqual([0, 2, 1]);
    expect(w[2].now).toBe(true);
    expect(w[2].week - w[1].week).toBe(1);
  });
  it("empty without heights", () => { expect(salesPerWeek([{}], 8)).toEqual([]); });
});
