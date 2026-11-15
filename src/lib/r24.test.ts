import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { actionAllowed, PUBLIC_ACTIONS } from "./operator";
import { resetLimits } from "./ratelimit";
import { SATS_WEIGHT, tally } from "./vote";

let perform: typeof import("./store").perform;
let readState: typeof import("./store").readState;
let getVotes: typeof import("./store").getVotes;
let POST: typeof import("../app/api/do/route").POST;
const file = path.join(os.tmpdir(), `vend-r24-${process.pid}.json`);
beforeAll(async () => {
  process.env.VEND_STATE_FILE = file;
  await fs.writeFile(file, JSON.stringify({ machines: [{ id: "m1", name: "M1", status: "Placed", prospectId: "x", hostName: "H", hostSharePct: 10, placedAt: "2026-01-01", profile: {}, slots: [] }] }));
  ({ perform, readState, getVotes } = await import("./store"));
  ({ POST } = await import("../app/api/do/route"));
});
afterAll(async () => { await fs.rm(file, { force: true }); });

describe("r24 the vote page is live", () => {
  it("lets anyone vote and suggest through /api/do, and nothing else new", () => {
    expect(PUBLIC_ACTIONS).toEqual(expect.arrayContaining(["vote", "suggest"]));
    expect(PUBLIC_ACTIONS).not.toContain("removeSuggestion");
    expect(actionAllowed("removeSuggestion", false).ok).toBe(true); // gate off in tests; with the gate on it is operator-only, like every action not in PUBLIC_ACTIONS
  });
  it("trims a suggestion, caps it at 40, refuses an empty one, and counts a repeat as a vote", async () => {
    expect((await perform({ action: "suggest", machine: "m1", name: "   " })).ok).toBe(false);
    expect((await perform({ action: "suggest", machine: "nope", name: "Chips" })).ok).toBe(false);
    expect((await perform({ action: "suggest", machine: "m1", name: "  Hot   chips  " })).ok).toBe(true);
    expect((await perform({ action: "suggest", machine: "m1", name: "x".repeat(60) })).ok).toBe(true);
    const r = await perform({ action: "suggest", machine: "m1", name: "hot chips" });
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/already on the list/);
    const st = await readState();
    expect(st.suggestions.m1.map((o) => o.name)).toEqual(["Hot chips", "x".repeat(40)]);
    const rows = await getVotes("m1");
    expect(rows.find((x) => x.name === "Hot chips")?.total).toBe(2);
  });
  it("counts every vote as 1, even one that claims sats, and refuses an item not on the list", async () => {
    const id = (await readState()).suggestions.m1[0].id;
    const before = (await getVotes("m1")).find((x) => x.id === id)!.total;
    expect((await perform({ action: "vote", machine: "m1", option: id, backed: true })).ok).toBe(true);
    expect((await getVotes("m1")).find((x) => x.id === id)!.total).toBe(before + 1);
    expect((await perform({ action: "vote", machine: "m1", option: "s999", backed: false })).ok).toBe(false);
    expect(SATS_WEIGHT).toBe(2); // kept for when a real payment sits behind a vote
    expect(tally([{ id: "a", name: "A", votes: 0, sats: 0 }], [{ option: "a", backed: true }])[0].total).toBe(2);
  });
  it("lets an operator remove a suggestion with its votes", async () => {
    const id = (await readState()).suggestions.m1[0].id;
    expect((await perform({ action: "removeSuggestion", machine: "m1", id })).ok).toBe(true);
    const st = await readState();
    expect(st.suggestions.m1.some((o) => o.id === id)).toBe(false);
    expect(st.ballots.m1.some((b) => b.option === id)).toBe(false);
    expect((await perform({ action: "removeSuggestion", machine: "m1", id })).ok).toBe(false);
  });
});

describe("r24 vote and suggestion limits", () => {
  beforeEach(() => resetLimits());
  const call = (body: object, ip: string) => POST(new Request("http://localhost/api/do", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": ip } }));
  it("allows 10 votes an hour from one phone, then refuses", async () => {
    const id = (await readState()).suggestions.m1[0].id;
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await call({ action: "vote", machine: "m1", option: id }, "203.0.113.9")).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
    expect((await call({ action: "vote", machine: "m1", option: id }, "203.0.113.10")).status).toBe(200);
  });
  it("allows 3 suggestions an hour from one phone, then refuses", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await call({ action: "suggest", machine: "m1", name: `Item ${i}` }, "198.51.100.9")).status);
    expect(codes).toEqual([200, 200, 200, 429]);
  });
});
