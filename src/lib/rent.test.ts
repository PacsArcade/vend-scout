import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { RENT_APPROVAL_KIND, approvalUnsigned, cleanRent, linesForOwner, owedLines, verifyRentApproval, type RentSlice } from "./rent";
import { cleanHostApp } from "./hostapp";
import type { Machine, Sale } from "./types";

const ownerSk = generateSecretKey(), ownerHex = getPublicKey(ownerSk), ownerNpub = nip19.npubEncode(ownerHex);
const otherHex = getPublicKey(generateSecretKey()), otherNpub = nip19.npubEncode(otherHex);
const opSk = generateSecretKey(), opHex = getPublicKey(opSk);
const machine = (id: string, owner: string, rent: Machine["rent"]): Machine => ({ id, name: id.toUpperCase(), status: "Placed", type: "snack", prospectId: "p", hostName: "H", hostSharePct: 10, placedAt: "", profile: {} as never, slots: [], ownerNpub: owner, rent });
const sale = (machine: string, sats: number, h: number, test = false): Sale => ({ machine, slot: "A1", item: "x", sats, at: "2026-01-01T00:00:00Z", h, test });
const slice = (): RentSlice => ({
  machines: [machine("m1", ownerNpub, { flatSats: 1000, percent: 10, periodBlocks: 1000, startH: 5000 }), machine("m2", otherNpub, { flatSats: 0, percent: 50, periodBlocks: 1000, startH: 5000 })],
  sales: [sale("m1", 3000, 5100), sale("m1", 2555, 5900), sale("m1", 9999, 5200, true), sale("m1", 4000, 6100), sale("m1", 777, 4000), sale("m2", 1001, 5500)],
  hostApps: [{ id: "o1", npub: ownerNpub, business: "B", address: "a", contactName: "", contact: "x@y.z", wantsHost: true, rentPref: "both", rentNote: "", payout: "me@wallet.example", payoutSource: "profile", stage: "Approved", machine: "m1", notes: [], createdAt: "" }],
});

describe("rent ledger math", () => {
  it("counts real sales per block period: flat plus floor(percent), test sales and pre-terms sales left out", () => {
    const lines = owedLines(slice(), 6500);
    const m1 = lines.filter((l) => l.machine === "m1");
    expect(m1.map((l) => l.period)).toEqual([0, 1]);
    expect(m1[0]).toMatchObject({ salesSats: 5555, percentSats: 555, flatSats: 1000, sats: 1555, state: "ready", address: "me@wallet.example", fromH: 5000, toH: 6000 });
    expect(m1[1]).toMatchObject({ state: "accruing", sats: 0, salesSats: 4000 }); // 6000-6999 still open
  });
  it("percent-only terms and a missing address", () => {
    const l = owedLines(slice(), 6500).find((x) => x.machine === "m2")!;
    expect(l).toMatchObject({ sats: 500, state: "needs address", address: "" });
  });
  it("a flat-only period with no sales is still owed once it closes", () => {
    const s = slice(); s.sales = [];
    const l = owedLines(s, 7001).filter((x) => x.machine === "m1" && x.state !== "accruing");
    expect(l.map((x) => [x.period, x.sats])).toEqual([[0, 1000], [1, 1000]]);
  });
  it("no terms or no owner means no lines", () => {
    const s = slice(); s.machines[0].rent = undefined; s.machines[1].ownerNpub = undefined;
    expect(owedLines(s, 9000)).toEqual([]);
  });
  it("cleanRent checks ranges", () => {
    expect(cleanRent({ flatSats: 100, percent: 5, periodBlocks: 4320 }, 1)).toEqual({ flatSats: 100, percent: 5, periodBlocks: 4320, startH: 1 });
    for (const bad of [{ flatSats: 0, percent: 0 }, { flatSats: -1 }, { percent: 101 }, { flatSats: 5, periodBlocks: 10 }]) expect(cleanRent(bad, 1)).toHaveProperty("error");
  });
});

describe("owner only views", () => {
  it("an owner sees only their own lines; a stranger or no key sees none", () => {
    const lines = owedLines(slice(), 6500);
    expect(linesForOwner(lines, ownerHex).every((l) => l.machine === "m1")).toBe(true);
    expect(linesForOwner(lines, otherHex).every((l) => l.machine === "m2")).toBe(true);
    expect(linesForOwner(lines, getPublicKey(generateSecretKey()))).toEqual([]);
    expect(linesForOwner(lines, null)).toEqual([]);
  });
});

describe("approval verification", () => {
  const now = Date.now();
  const lineOf = () => owedLines(slice(), 6500).find((l) => l.id.startsWith("m1") && l.period === 0)!;
  const sign = (sk: Uint8Array, l = lineOf(), at = now) => finalizeEvent(approvalUnsigned(l, at), sk);
  const opts = { operators: [opHex], cap: 10_000, now };
  it("accepts a good signature from the operator key", () => {
    expect(verifyRentApproval(sign(opSk), lineOf(), opts)).toEqual({ ok: true, pubkey: opHex });
  });
  it("refuses a bad signature", () => {
    const ev = JSON.parse(JSON.stringify(sign(opSk))); ev.sig = ev.sig.slice(0, -2) + (ev.sig.endsWith("00") ? "11" : "00");
    expect(verifyRentApproval(ev, lineOf(), opts)).toMatchObject({ ok: false, reason: "The signature check failed" });
  });
  it("refuses a key that is not an operator", () => {
    expect(verifyRentApproval(sign(ownerSk), lineOf(), opts)).toMatchObject({ ok: false, reason: expect.stringContaining("operator list") });
  });
  it("refuses when the amount changed after signing", () => {
    const ev = sign(opSk);
    const changed = { ...lineOf(), sats: lineOf().sats + 1 };
    expect(verifyRentApproval(ev, changed, opts)).toMatchObject({ ok: false, reason: expect.stringContaining("changed") });
    expect(verifyRentApproval(sign(opSk, { ...lineOf(), sats: 99999 }), lineOf(), { ...opts, cap: 1_000_000 })).toMatchObject({ ok: false });
  });
  it("refuses a changed address", () => {
    expect(verifyRentApproval(sign(opSk, { ...lineOf(), address: "evil@wallet.example" }), lineOf(), opts).ok).toBe(false);
  });
  it("refuses an amount over the cap even with a valid signature", () => {
    expect(verifyRentApproval(sign(opSk), lineOf(), { ...opts, cap: 1000 })).toMatchObject({ ok: false, reason: expect.stringContaining("cap") });
  });
  it("refuses an old event, the wrong kind, an open period, a missing address and an unknown line", () => {
    expect(verifyRentApproval(sign(opSk, lineOf(), now - 3_600_000), lineOf(), opts)).toMatchObject({ ok: false, reason: expect.stringContaining("too old") });
    expect(verifyRentApproval(finalizeEvent({ ...approvalUnsigned(lineOf(), now), kind: 1 }, opSk), lineOf(), opts).ok).toBe(false);
    const open = owedLines(slice(), 6500).find((l) => l.state === "accruing")!;
    expect(verifyRentApproval(sign(opSk, open), open, opts)).toMatchObject({ ok: false, reason: expect.stringContaining("not over") });
    const noAddr = owedLines(slice(), 6500).find((l) => l.state === "needs address")!;
    expect(verifyRentApproval(sign(opSk, noAddr), noAddr, opts)).toMatchObject({ ok: false, reason: expect.stringContaining("Lightning address") });
    expect(verifyRentApproval(sign(opSk), undefined, opts)).toMatchObject({ ok: false, reason: "No such owed line" });
  });
  it("a recorded approval marks the line approved, not sent, until the line changes", () => {
    const s = slice(); const l = lineOf();
    s.rentApprovals = { [l.id]: { line: l.id, sats: l.sats, address: l.address, eventId: "e", by: opHex, at: "" } };
    expect(owedLines(s, 6500).find((x) => x.id === l.id)!.state).toBe("approved");
    s.sales.push(sale("m1", 1000, 5300)); // a late sale changes the amount
    const again = owedLines(s, 6500).find((x) => x.id === l.id)!;
    expect(again.state).toBe("ready"); expect(again.staleApproval).toBe(true);
    expect(RENT_APPROVAL_KIND).toBe(27001);
  });
});

describe("owner application checks", () => {
  const good = { business: "Sunrise", address: "1 Main", contact: "a@b.co", payout: "Me@Wallet.example" };
  it("accepts a good application and lowercases the address", () => {
    const r = cleanHostApp(good, ownerHex, []);
    expect(r.ok && r.app.payout).toBe("me@wallet.example");
    expect(r.ok && r.app.npub).toBe(ownerNpub);
  });
  it("refuses a bad Lightning address, missing fields, a seed-like payout and a second application", () => {
    expect(cleanHostApp({ ...good, payout: "nope" }, ownerHex, []).ok).toBe(false);
    expect(cleanHostApp({ ...good, payout: "one two three four five six seven" }, ownerHex, []).ok).toBe(false);
    expect(cleanHostApp({ ...good, business: "" }, ownerHex, []).ok).toBe(false);
    expect(cleanHostApp({ ...good, contact: "x" }, ownerHex, []).ok).toBe(false);
    expect(cleanHostApp(good, "bad", []).ok).toBe(false);
    const first = cleanHostApp(good, ownerHex, []); if (!first.ok) throw new Error();
    expect(cleanHostApp(good, ownerHex, [{ ...first.app, id: "o1", stage: "Applied", notes: [], createdAt: "" }]).ok).toBe(false);
  });
});
