import { describe, expect, it } from "vitest";
import { face, faceText, nextArrival, HOLD_S } from "./liveBft";

const H = 974004; // block-in-day 974004 % 144
describe("live BFT face", () => {
  it("shows the live minute digit and the seconds, not a bare 0", () => {
    const a = { height: H, at: 1_000_000, est: false };
    const f0 = face(a, 1_000_000);
    const f = face(a, 1_000_000 + 187_000); // 3:07 after arrival
    expect(f0.time.endsWith(":00")).toBe(true);
    expect(f.time.slice(-4)).toBe(`${Number(f0.time.slice(3, 5)) + 3}`.padStart(2, "0").slice(-1) + ":07");
    expect(f.pct).toBe(31);
  });
  it("holds at 9:59 until a new block lands", () => {
    const a = { height: H, at: 0, est: false };
    const f = face(a, 3_600_000); // an hour later, still no new block
    expect(f.held).toBe(true);
    expect(f.time.slice(-4)).toBe("9:59");
    expect(f.pct).toBe(100);
    expect(HOLD_S).toBe(599);
  });
  it("a cold load uses the tip timestamp as an estimate marked ~", () => {
    const now = 10_000_000;
    const a = nextArrival(null, H, (now - 125_000) / 1000, now);
    expect(a.est).toBe(true);
    expect(faceText(face(a, now))).toContain("~");
    expect(face(a, now).time.slice(-4)).toMatch(/2:05$/);
  });
  it("a cold load with no timestamp starts at zero and is still marked ~", () => {
    const a = nextArrival(null, H, null, 5_000);
    expect(a.est).toBe(true);
    expect(face(a, 5_000).time.endsWith("0:00")).toBe(true);
  });
  it("a new block seen live resets to 0:00 and drops the ~", () => {
    const cold = nextArrival(null, H, 1, 100_000);
    const next = nextArrival(cold, H + 1, null, 700_000);
    expect(next.est).toBe(false);
    expect(next.at).toBe(700_000);
    expect(face(next, 700_000).time.endsWith("0:00")).toBe(true);
  });
  it("the same height changes nothing", () => {
    const a = { height: H, at: 5, est: false };
    expect(nextArrival(a, H, 999, 50_000)).toBe(a);
  });
});
