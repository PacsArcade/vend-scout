import { describe, expect, it, beforeEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { autoCheck } from "./autoCheck";
import { scoreStop, comboBonus, streakDays, levelOf, boardName, badgesFor } from "./arcade";
import { ARCADE, SPEED_SCORING, NEVER_SPEED_LINE } from "./gig";

let perform: typeof import("./store").perform;
let readState: typeof import("./store").readState;
const file = path.join(os.tmpdir(), `vend-proof-test-${process.pid}.json`);
const PH = { before: "r1-1.png", after: "r1-2.png" };

beforeEach(async () => {
  process.env.VEND_STATE_FILE = file;
  const now = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify({
    machines: [{ id: "m1", name: "M", status: "Placed", type: "snack", prospectId: "x", hostName: "H", hostSharePct: 10, placedAt: "2026-01-01", profile: {}, slots: [{ code: "A1", name: "chips", kind: "snack", level: 0.1, priceSats: 3000 }] }],
    applicants: [{ id: "a1", name: "Pat Lee", reach: "p@x.co", area: "Chicago", roles: ["runner"], transport: [], hours: "", why: "", stage: "On the crew", lightning: "pat@wallet.example", notes: [], createdAt: "2026-01-01" }],
    claims: [{ job: "restock:m1", kind: "restock", title: "Restock M", sats: 7000, by: "a1", at: now }],
  }));
  ({ perform, readState } = await import("./store"));
});

describe("pay after proof", () => {
  it("sending proof does not pay and does not finish the job", async () => {
    const r = await perform({ action: "submitProof", kind: "job", ref: "restock:m1", ...PH, ticked: ["A1"], loadTotal: 1 });
    expect(r.ok).toBe(true);
    const st = await readState();
    expect(st.payouts.length).toBe(0);
    expect(st.claims[0].doneAt).toBeUndefined();
    expect(st.proofs[0].status).toBe("sent");
  });
  it("needs both photos", async () => {
    expect((await perform({ action: "submitProof", kind: "job", ref: "restock:m1", before: "", after: "r1-2.png", ticked: [], loadTotal: 0 })).ok).toBe(false);
  });
  it("approval pays once and double approve does not pay twice", async () => {
    await perform({ action: "submitProof", kind: "job", ref: "restock:m1", ...PH, ticked: ["A1"], loadTotal: 1 });
    const id = (await readState()).proofs[0].id;
    const a = await perform({ action: "reviewProof", id, decision: "approve" });
    expect(a.ok).toBe(true);
    expect(a.note).toContain("Paid 7,000 sats");
    expect((await perform({ action: "reviewProof", id, decision: "approve" })).ok).toBe(false);
    const st = await readState();
    expect(st.payouts.length).toBe(1);
    expect(st.claims[0].doneAt).toBeTruthy();
  });
  it("a retake loops back to sent and nothing is paid until it is approved", async () => {
    await perform({ action: "submitProof", kind: "job", ref: "restock:m1", ...PH, ticked: [], loadTotal: 1 });
    const id = (await readState()).proofs[0].id;
    expect((await perform({ action: "reviewProof", id, decision: "retake" })).ok).toBe(false); // a reason is needed
    expect((await perform({ action: "reviewProof", id, decision: "retake", reason: "Glass is blurry" })).ok).toBe(true);
    let st = await readState();
    expect(st.proofs[0].status).toBe("retake");
    expect(st.payouts.length).toBe(0);
    expect((await perform({ action: "submitProof", kind: "job", ref: "restock:m1", ...PH, ticked: ["A1"], loadTotal: 1 })).ok).toBe(true);
    st = await readState();
    expect(st.proofs.length).toBe(1);
    expect(st.proofs[0].status).toBe("sent");
    expect(st.proofs[0].history.map((e) => e.status)).toEqual(["sent", "retake", "sent"]);
    await perform({ action: "reviewProof", id, decision: "approve" });
    expect((await readState()).payouts.length).toBe(1);
  });
  it("the auto-check stub always sends it to a person", () => {
    expect(autoCheck({ ...PH, ticked: [], loadTotal: 0 })).toBe("needs-human");
  });
});

describe("arcade score", () => {
  const base = { loadTotal: 3, ticked: 3, checkerSaysLoadMatches: true, checkerSaysGlassClean: true, soldOutAtVisit: false, localDelivered: false, inBlock: false, streakDays: 1 };
  it("scores each part", () => {
    const s = scoreStop(base);
    expect(s.points).toBe(ARCADE.stop + ARCADE.fullFill + ARCADE.cleanGlass + ARCADE.beforeSellOut);
  });
  it("no full fill when a slot is not ticked, no stock bonus after a sell-out", () => {
    const s = scoreStop({ ...base, ticked: 2, soldOutAtVisit: true });
    expect(s.breakdown.map((b) => b.label)).toEqual(["Stop done", "Clean glass"]);
  });
  it("local delivery, block and streak add points", () => {
    const s = scoreStop({ ...base, localDelivered: true, inBlock: true, streakDays: 3 });
    expect(s.points).toBe(ARCADE.stop + ARCADE.fullFill + ARCADE.cleanGlass + ARCADE.beforeSellOut + ARCADE.localDelivered + ARCADE.inBlock + ARCADE.streakStep * 2);
  });
  it("never scores speed", () => {
    expect(SPEED_SCORING).toBe(false);
    expect(NEVER_SPEED_LINE).toBe("We never score speed. Drive safe.");
    expect(Object.keys(base).some((k) => /speed|time|minute|second|duration/i.test(k))).toBe(false);
  });
  it("combo is half again on the route points", () => expect(comboBonus(1000)).toBe(500));
  it("a streak counts days in a row ending today", () => {
    expect(streakDays(["2026-11-01", "2026-10-31", "2026-10-30", "2026-10-28"], "2026-11-01")).toBe(3);
    expect(streakDays(["2026-10-30"], "2026-11-01")).toBe(0);
  });
  it("levels and leaderboard names", () => {
    expect(levelOf(0).name).toBe("Rookie");
    expect(levelOf(1600).name).toBe("Pro");
    expect(boardName("Taylor Reed")).toBe("Taylor R.");
    expect(boardName("Madonna")).toBe("Madonna");
    expect(badgesFor([], "a1").every((b) => !b.got)).toBe(true);
  });
});
