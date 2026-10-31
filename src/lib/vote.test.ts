import { describe, expect, it } from "vitest";
import { tally } from "./vote";

const opts = [
  { id: "a", name: "A", votes: 3, sats: 0 },
  { id: "b", name: "B", votes: 2, sats: 0 },
];
describe("tally", () => {
  it("adds plain votes", () => expect(tally(opts, [{ option: "b", backed: false }]).find((r) => r.id === "b")?.total).toBe(3));
  it("sats-backed votes count double", () => expect(tally(opts, [{ option: "b", backed: true }]).find((r) => r.id === "b")?.total).toBe(4));
  it("sorts by total and scales percent to the leader", () => {
    const r = tally(opts, [{ option: "b", backed: true }, { option: "b", backed: true }]);
    expect(r[0].id).toBe("b");
    expect(r[0].pct).toBe(100);
  });
});
