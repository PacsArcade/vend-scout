import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { unwrapEvent } from "nostr-tools/nip17";
import { fetchInvoice, publicHost } from "./zap";
import { SKIPPED, sendWelcomeDm, senderKey, welcomeText } from "./dm";
import { latestProof, machineTag, shareNoteOk, SHARE_TAGS } from "./social";
import { pathIsPublic } from "./operator";
import { CREDITS } from "./gig";

const NB = getPublicKey(generateSecretKey()), NB2 = getPublicKey(generateSecretKey());
let perform: typeof import("./store").perform, readState: typeof import("./store").readState, grantCredits: typeof import("./store").grantCredits;
const file = path.join(os.tmpdir(), `vend-social-${process.pid}.json`);
beforeEach(async () => {
  vi.resetModules();
  process.env.VEND_STATE_FILE = file; process.env.VEND_AI_CHECK = "off";
  const t = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify({
    machines: [{ id: "m1", name: "M1", status: "Placed", type: "snack", prospectId: "x", hostName: "H", hostSharePct: 10, placedAt: t.slice(0, 10), profile: {}, slots: [] }],
    applicants: [{ id: "a1", name: "Maya Reyes", reach: "m@x.co", area: "Chicago", roles: ["runner"], transport: [], hours: "", why: "", stage: "On the crew", lightning: "maya@wallet.example", notes: [], createdAt: "2026-01-01" }],
    proofs: [{ id: "p1", kind: "job", ref: "restock:m1", by: "a1", machine: "m1", jobKind: "restock", before: "r1-1.png", after: "r1-2.png", ticked: [], loadTotal: 0, soldOutAtVisit: false, status: "sent", history: [{ status: "sent", at: t }], sentAt: t }],
  }));
  ({ perform, readState, grantCredits } = await import("./store"));
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("vending machine credits", () => {
  it("a verify earns credits once per machine per day per npub, and is recorded on the job", async () => {
    const a = await perform({ action: "neighborVerify", machine: "m1", npub: NB });
    expect(a.ok).toBe(true);
    expect(a.note).toContain(`+${CREDITS.verify}`);
    let st = await readState();
    expect(st.credits[NB]).toBe(CREDITS.verify);
    expect(st.verifies).toHaveLength(1);
    expect(st.verifies[0]).toMatchObject({ proof: "p1", machine: "m1", npub: NB });
    // the same neighbor again: no second record and no more credits
    const b = await perform({ action: "neighborVerify", machine: "m1", npub: NB });
    expect(b.ok).toBe(false);
    st = await readState();
    expect(st.credits[NB]).toBe(CREDITS.verify);
    // a different neighbor earns their own
    await perform({ action: "neighborVerify", machine: "m1", npub: NB2 });
    expect((await readState()).credits[NB2]).toBe(CREDITS.verify);
  });
  it("sharing earns credits once per machine per day per npub", async () => {
    expect((await perform({ action: "shareCredit", machine: "m1", npub: NB })).note).toContain(`+${CREDITS.share}`);
    const again = await perform({ action: "shareCredit", machine: "m1", npub: NB });
    expect(again.ok).toBe(true);
    expect(again.note).toContain("once a day");
    expect((await readState()).credits[NB]).toBe(CREDITS.share);
    // verify is its own kind, so it still earns today
    await perform({ action: "neighborVerify", machine: "m1", npub: NB });
    expect((await readState()).credits[NB]).toBe(CREDITS.share + CREDITS.verify);
  });
  it("credits come back tomorrow (a different day)", async () => {
    const st = await readState();
    grantCredits(st, NB, "share", "m1", 5);
    st.creditLog[0].day = "2000-01-01"; // an old day
    expect(grantCredits(st, NB, "share", "m1", 5)).toBe(true);
    expect(st.credits[NB]).toBe(10);
  });
  it("a verify is only extra evidence: it never approves a proof or pays anyone", async () => {
    await perform({ action: "neighborVerify", machine: "m1", npub: NB });
    const st = await readState();
    expect(st.proofs[0].status).toBe("sent");
    expect(st.payouts).toEqual([]);
  });
  it("spending needs enough credits and is logged", async () => {
    await perform({ action: "neighborVerify", machine: "m1", npub: NB });
    expect((await perform({ action: "spendCredits", machine: "m1", npub: nip19.npubEncode(NB), amount: 999 })).ok).toBe(false);
    expect((await perform({ action: "spendCredits", machine: "m1", npub: nip19.npubEncode(NB), amount: 4 })).ok).toBe(true);
    expect((await readState()).credits[NB]).toBe(CREDITS.verify - 4);
  });
  it("needs a real key and a photo to verify, and reports need a reason", async () => {
    expect((await perform({ action: "neighborVerify", machine: "m1", npub: "nope" })).ok).toBe(false);
    expect((await perform({ action: "neighborReport", machine: "m1", npub: NB, reason: "", text: "" })).ok).toBe(false);
    expect((await perform({ action: "neighborReport", machine: "m1", npub: NB, reason: "The machine is empty", text: "A1 is bare" })).ok).toBe(true);
    expect((await perform({ action: "requestItems", machine: "m1", npub: NB, text: "Hot chips" })).ok).toBe(true);
    const st = await readState();
    expect(st.reports[0]).toMatchObject({ machine: "m1", reason: "The machine is empty" });
    expect(st.itemRequests[0].text).toBe("Hot chips");
  });
});

describe("share note check", () => {
  const ok = { kind: 1, pubkey: NB, content: `Found snacks ${SHARE_TAGS("m1")}`, created_at: Math.floor(Date.now() / 1000) };
  it("accepts a fresh note with both tags signed by the same key", () => expect(shareNoteOk(ok, NB, "m1")).toBeNull());
  it("refuses a missing tag, someone else's note, and an old note", () => {
    expect(shareNoteOk({ ...ok, content: "#frensvend only" }, NB, "m1")).toContain("both tags");
    expect(shareNoteOk(ok, NB2, "m1")).toContain("not signed by you");
    expect(shareNoteOk({ ...ok, created_at: 1 }, NB, "m1")).toContain("too old");
    expect(machineTag("m1")).toBe("FV-M1");
  });
});

describe("welcome DM", () => {
  it("with no sender key it is skipped, logged, and the text comes back to show", async () => {
    vi.stubEnv("VEND_DM_SENDER_KEY", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const publish = vi.fn();
    const r = await sendWelcomeDm(NB, "Hello", publish);
    expect(r).toMatchObject({ sent: false, skipped: SKIPPED, text: "Hello" });
    expect(SKIPPED).toBe("dm skipped: no sender key");
    expect(publish).not.toHaveBeenCalled();
    expect(info.mock.calls.some((c) => String(c[0]).includes("dm skipped: no sender key"))).toBe(true);
    info.mockRestore();
  });
  it("with a key it wraps a private message only the recipient can open, and counts relays", async () => {
    const sk = generateSecretKey(), rk = generateSecretKey();
    vi.stubEnv("VEND_DM_SENDER_KEY", nip19.nsecEncode(sk));
    expect(senderKey()).toEqual(sk);
    let wrap: import("nostr-tools").NostrEvent | null = null;
    const r = await sendWelcomeDm(getPublicKey(rk), "Hello Maya", async (ev) => { wrap = ev; return 2; });
    expect(r).toMatchObject({ sent: true, relays: 2 });
    expect(wrap!.kind).toBe(1059);
    expect(wrap!.tags.find((t) => t[0] === "p")?.[1]).toBe(getPublicKey(rk));
    expect(unwrapEvent(wrap!, rk).content).toBe("Hello Maya");
    expect(JSON.stringify(wrap)).not.toContain("Hello Maya");
  });
  it("a relay that takes nothing is reported, not hidden", async () => {
    vi.stubEnv("VEND_DM_SENDER_KEY", nip19.nsecEncode(generateSecretKey()));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendWelcomeDm(NB, "Hi", async () => 0)).sent).toBe(false);
    err.mockRestore();
  });
  it("the text names the person, the job and the pay as test sats, with no dollar sign", () => {
    const t = welcomeText({ name: "Maya Reyes", jobTitle: "Restock M1", sats: 7000, url: "https://x.test/jobs" });
    expect(t).toContain("Welcome to the Vend Scout crew, Maya.");
    expect(t).toContain("Restock M1");
    expect(t).toContain("7,000 sats (test)");
    expect(t).not.toMatch(/\$|—/);
  });
  it("a sign-in logs the DM, and only the first one sends (a resend is on purpose)", async () => {
    vi.stubEnv("VEND_DM_SENDER_KEY", "");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const st = await readState();
    st.applicants[0].npub = nip19.npubEncode(NB);
    await fs.writeFile(file, JSON.stringify(st));
    const { welcomeDmFor } = await import("./welcome");
    const r = await welcomeDmFor("a1", "https://x.test");
    expect(r.sent).toBe(false);
    expect(r.hasKey).toBe(false);
    expect(r.text).toContain("Welcome to the Vend Scout crew, Maya.");
    expect((await readState()).dms[0]).toMatchObject({ to: NB, sent: false, reason: SKIPPED });
  });
});

describe("tip invoices (zaps)", () => {
  const goodLookup = async () => [{ address: "93.184.216.34" }];
  const pay = { tag: "payRequest", callback: "https://wallet.example/cb", minSendable: 1000, maxSendable: 1_000_000_000, allowsNostr: true, nostrPubkey: "ab" };
  const mk = (sk: Uint8Array, sats: number, runner: string) => finalizeEvent({ kind: 9734, created_at: Math.floor(Date.now() / 1000), content: "", tags: [["p", runner], ["amount", String(sats * 1000)], ["relays", "wss://r"]] }, sk);
  it("refuses private and odd hosts", async () => {
    for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "foo.local", "nodots"]) expect(await publicHost(h, goodLookup)).toBe(false);
    expect(await publicHost("wallet.example", async () => [{ address: "10.1.2.3" }])).toBe(false);
    expect(await publicHost("wallet.example", goodLookup)).toBe(true);
  });
  it("fetches a plain invoice, and passes a valid zap request along when the wallet takes zaps", async () => {
    const urls: string[] = [];
    const f = (async (u: string) => { urls.push(u); return new Response(JSON.stringify(u.includes("lnurlp") ? pay : { pr: "lnbc210n1invoice" })); }) as unknown as typeof fetch;
    const runnerSk = generateSecretKey(), runner = getPublicKey(runnerSk), tipperSk = generateSecretKey();
    const plain = await fetchInvoice("maya@wallet.example", 210, null, runner, { fetchImpl: f, lookup: goodLookup });
    expect(plain).toMatchObject({ ok: true, zap: false, pr: "lnbc210n1invoice" });
    expect(urls[1]).toContain("amount=210000");
    expect(urls[1]).not.toContain("nostr=");
    urls.length = 0;
    const z = await fetchInvoice("maya@wallet.example", 210, mk(tipperSk, 210, runner), runner, { fetchImpl: f, lookup: goodLookup });
    expect(z).toMatchObject({ ok: true, zap: true });
    expect(urls[1]).toContain("nostr=");
  });
  it("ignores a zap request for the wrong person or amount", async () => {
    const f = (async (u: string) => new Response(JSON.stringify(u.includes("lnurlp") ? pay : { pr: "lnbc1invoice" }))) as unknown as typeof fetch;
    const runner = getPublicKey(generateSecretKey()), other = getPublicKey(generateSecretKey());
    expect((await fetchInvoice("m@wallet.example", 210, mk(generateSecretKey(), 210, other), runner, { fetchImpl: f, lookup: goodLookup })).zap).toBe(false);
    expect((await fetchInvoice("m@wallet.example", 210, mk(generateSecretKey(), 21, runner), runner, { fetchImpl: f, lookup: goodLookup })).zap).toBe(false);
  });
  it("rejects bad amounts, bad addresses and a wallet that is not LNURL-pay, and never throws", async () => {
    const f = (async () => new Response(JSON.stringify({ tag: "withdrawRequest" }))) as unknown as typeof fetch;
    expect((await fetchInvoice("m@wallet.example", 0, null, null, { fetchImpl: f, lookup: goodLookup })).ok).toBe(false);
    expect((await fetchInvoice("m@wallet.example", 5_000_000, null, null, { fetchImpl: f, lookup: goodLookup })).ok).toBe(false);
    expect((await fetchInvoice("not-an-address", 21, null, null, { fetchImpl: f, lookup: goodLookup })).ok).toBe(false);
    expect((await fetchInvoice("m@wallet.example", 21, null, null, { fetchImpl: f, lookup: goodLookup })).error).toContain("did not answer like a Lightning address");
    const boom = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await fetchInvoice("m@wallet.example", 21, null, null, { fetchImpl: boom, lookup: goodLookup })).ok).toBe(false);
  });
});

describe("what is public", () => {
  it("the neighbor page, its photo, sign-in, acts and the tip invoice are public; the DM resend is crew-only", () => {
    expect(pathIsPublic("/m/m1", false)).toBe(true);
    for (const p of ["/api/m/m1/photo", "/api/neighbor/session", "/api/neighbor/act", "/api/zap/invoice"]) expect(pathIsPublic(p, true)).toBe(true);
    expect(pathIsPublic("/api/crew/dm", true)).toBe(false);
    expect(pathIsPublic("/api/stopphoto/r1-1.png", true)).toBe(false);
  });
  it("the neighbor page shows the newest waiting or approved photo and not a retake", () => {
    const base = { machine: "m1", sentAt: "2026-01-01T00:00:00Z" };
    const p = latestProof({ proofs: [{ ...base, id: "a", status: "approved" }, { ...base, id: "b", sentAt: "2026-02-01T00:00:00Z", status: "retake" }, { ...base, id: "c", sentAt: "2026-01-15T00:00:00Z", status: "sent" }] as never }, "m1");
    expect(p?.id).toBe("c");
  });
});
