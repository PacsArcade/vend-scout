import { describe, expect, it, beforeEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { AUTO_APPROVE, checkProof, mayAutoApprove, parseVerdict } from "./autoCheck";

const input = { before: "r0-1.png", after: "r0-2.png", loadItems: [{ slot: "A1", item: "Hot chips", ref: "i0-1.png" }] };
const photos = async () => "AAAA";
const good = { slots: [{ slot: "A1", expected_item: "Hot chips", looks_stocked: "yes", matches_item: "yes" }], glass_clean: "yes", overall: "pass", reasons: ["all good"] };
const ok = (obj: unknown) => (async () => new Response(JSON.stringify({ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) } }))) as unknown as typeof fetch;

describe("photo checker is safe", () => {
  it("a clean, valid answer passes (as a suggestion)", async () => {
    const v = await checkProof(input, { fetchImpl: ok(good), readPhoto: photos });
    expect(v.overall).toBe("pass");
    expect(v.glassClean).toBe("yes");
  });
  it("malformed JSON is needs-human", async () => {
    expect((await checkProof(input, { fetchImpl: ok("not json {"), readPhoto: photos })).overall).toBe("needs-human");
    expect((await checkProof(input, { fetchImpl: ok({ slots: "nope" }), readPhoto: photos })).overall).toBe("needs-human");
  });
  it("a missing slot in the answer is needs-human", async () => {
    expect((await checkProof(input, { fetchImpl: ok({ ...good, slots: [] }), readPhoto: photos })).overall).toBe("needs-human");
  });
  it("any unsure or no is needs-human even if the model says pass", async () => {
    const unsure = { ...good, slots: [{ ...good.slots[0], looks_stocked: "unsure" }] };
    expect((await checkProof(input, { fetchImpl: ok(unsure), readPhoto: photos })).overall).toBe("needs-human");
    expect((await checkProof(input, { fetchImpl: ok({ ...good, glass_clean: "no" }), readPhoto: photos })).overall).toBe("needs-human");
  });
  it("a timeout is needs-human and never throws", async () => {
    const slow = (async (_u: unknown, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("t"), { name: "TimeoutError" }))))) as unknown as typeof fetch;
    const v = await checkProof(input, { fetchImpl: slow, timeoutMs: 20, readPhoto: photos });
    expect(v.overall).toBe("needs-human");
    expect(v.error).toContain("too long");
  });
  it("Ollama down is needs-human and never throws", async () => {
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const v = await checkProof(input, { fetchImpl: down, readPhoto: photos });
    expect(v.overall).toBe("needs-human");
    expect(v.error).toContain("not reachable");
  });
  it("unreadable photos are needs-human without calling the model", async () => {
    let called = false;
    const f = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
    expect((await checkProof(input, { fetchImpl: f, readPhoto: async () => null })).overall).toBe("needs-human");
    expect(called).toBe(false);
  });
  it("parseVerdict rejects odd values", () => {
    expect(parseVerdict(JSON.stringify({ ...good, glass_clean: "maybe" }), [{ slot: "A1", item: "x" }])).toBeNull();
  });
  it("AUTO_APPROVE is false, so a pass never approves anything", async () => {
    expect(AUTO_APPROVE).toBe(false);
    const v = await checkProof(input, { fetchImpl: ok(good), readPhoto: photos });
    expect(mayAutoApprove(v)).toBe(false);
  });
});

describe("shadow mode in the store", () => {
  let perform: typeof import("./store").perform, readState: typeof import("./store").readState;
  const file = path.join(os.tmpdir(), `vend-ai-test-${process.pid}.json`);
  beforeEach(async () => {
    process.env.VEND_STATE_FILE = file; process.env.VEND_AI_CHECK = "off";
    const now = new Date().toISOString();
    await fs.writeFile(file, JSON.stringify({
      machines: [{ id: "m1", name: "M", status: "Placed", type: "snack", prospectId: "x", hostName: "H", hostSharePct: 10, placedAt: "2026-01-01", profile: {}, slots: [{ code: "A1", name: "chips", kind: "snack", level: 0.1, priceSats: 3000 }] }],
      applicants: [{ id: "a1", name: "Pat Lee", reach: "p@x.co", area: "Chicago", roles: ["runner"], transport: [], hours: "", why: "", stage: "On the crew", lightning: "pat@wallet.example", notes: [], createdAt: "2026-01-01" }],
      claims: [{ job: "restock:m1", kind: "restock", title: "Restock M", sats: 7000, by: "a1", at: now }],
    }));
    ({ perform, readState } = await import("./store"));
  });
  const verdict = async () => checkProof(input, { fetchImpl: ok(good), readPhoto: photos });
  it("a recorded AI pass pays nothing and approves nothing", async () => {
    await perform({ action: "submitProof", kind: "job", ref: "restock:m1", before: "r1-1.png", after: "r1-2.png", ticked: ["A1"], loadTotal: 1 });
    const id = (await readState()).proofs[0].id;
    await perform({ action: "recordAi", id, verdict: await verdict() });
    const st = await readState();
    expect(st.proofs[0].ai?.overall).toBe("pass");
    expect(st.proofs[0].status).toBe("sent");
    expect(st.payouts.length).toBe(0);
  });
  it("the agreement log records both sides", async () => {
    await perform({ action: "submitProof", kind: "job", ref: "restock:m1", before: "r1-1.png", after: "r1-2.png", ticked: ["A1"], loadTotal: 1 });
    const id = (await readState()).proofs[0].id;
    await perform({ action: "recordAi", id, verdict: await verdict() });
    await perform({ action: "reviewProof", id, decision: "retake", reason: "Glass is smeared" });
    const log = (await readState()).aiLog;
    expect(log.length).toBe(1);
    expect(log[0]).toMatchObject({ aiOverall: "pass", humanDecision: "retake", agree: false });
  });
  it("agreement when the person approves with both flags ticked", async () => {
    await perform({ action: "submitProof", kind: "job", ref: "restock:m1", before: "r1-1.png", after: "r1-2.png", ticked: ["A1"], loadTotal: 1 });
    const id = (await readState()).proofs[0].id;
    await perform({ action: "recordAi", id, verdict: await verdict() });
    await perform({ action: "reviewProof", id, decision: "approve", glassClean: true, loadMatches: true });
    expect((await readState()).aiLog[0].agree).toBe(true);
  });
});
