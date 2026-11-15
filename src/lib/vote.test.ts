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

// r26 (card 05, his pick B): the vote page promises less. Votes help choose the restock; they do not decide it.
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { VOTE_PROMISE } from "./vote";
describe("the vote promise", () => {
  it("is the softened line", () => expect(VOTE_PROMISE).toBe("Top picks help us choose the next restock."));
  it("is what the vote page shows, and the old promise is gone everywhere", () => {
    const root = path.join(__dirname, "..");
    expect(readFileSync(path.join(root, "app/vote/[machine]/page.tsx"), "utf8")).toContain("{VOTE_PROMISE}");
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const f = path.join(d, n); return statSync(f).isDirectory() ? walk(f) : /\.tsx?$/.test(n) && !n.endsWith(".test.ts") ? [f] : []; });
    for (const f of walk(root)) expect(readFileSync(f, "utf8"), f).not.toMatch(/go in on the next restock/i);
  });
});
