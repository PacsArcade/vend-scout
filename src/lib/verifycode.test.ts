import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import { checkSigned, codeFor, issue, viewFor, windowOf } from "./verifycode";
import { VERIFY_KIND, verifyContent } from "./verifyevent";

// Keys here are made in memory for these tests only. Nothing is saved or sent.
const SEC = "test-secret-not-real";
const crewSk = generateSecretKey(), crewHex = getPublicKey(crewSk);
const otherSk = generateSecretKey();
const NOW = 1_800_000_030_000; // 30 s into a window
// JSON round trip: the server only ever sees parsed JSON, and finalizeEvent marks its result as already verified.
const sign = (sk: Uint8Array, target: string, code: string, at = NOW, over: Partial<{ content: string; tags: string[][] }> = {}) =>
  JSON.parse(JSON.stringify(finalizeEvent({ kind: VERIFY_KIND, created_at: Math.floor(at / 1000), tags: over.tags ?? [["p", target], ["code", code]], content: over.content ?? verifyContent(target, code) }, sk)));
const cur = () => issue(crewHex, NOW, SEC).code;
const opts = (more: object = {}) => ({ targetHex: crewHex, onCrew: true, now: NOW, secret: SEC, ...more });

describe("signed one-time code", () => {
  it("makes a stable 6 character code per key and window, different for another key or window", () => {
    const c = codeFor(crewHex, 5, SEC);
    expect(c).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    expect(codeFor(crewHex, 5, SEC)).toBe(c);
    expect(codeFor(crewHex, 6, SEC)).not.toBe(c);
    expect(codeFor(getPublicKey(otherSk), 5, SEC)).not.toBe(c);
  });
  it("accepts a good signature from the crew key", () => {
    const r = checkSigned(sign(crewSk, crewHex, cur()), opts());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.record.code).toBe(cur());
  });
  it("says plainly when a different key signed the right code", () => {
    const r = checkSigned(sign(otherSk, crewHex, cur()), opts());
    expect(r).toMatchObject({ ok: false, code: "wrong-key" });
    if (!r.ok) { expect(r.reason).toMatch(/different key/); expect(r.wrong?.by).toBe(getPublicKey(otherSk)); }
  });
  it("refuses an expired code", () => {
    const old = codeFor(crewHex, windowOf(NOW) - 2, SEC);
    expect(checkSigned(sign(crewSk, crewHex, old), opts())).toMatchObject({ ok: false, code: "expired" });
  });
  it("refuses an old signature even with the right code", () => {
    expect(checkSigned(sign(crewSk, crewHex, cur(), NOW - 400_000), opts())).toMatchObject({ ok: false, code: "stale" });
  });
  it("refuses a reused code", () => {
    const first = checkSigned(sign(crewSk, crewHex, cur()), opts());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = checkSigned(sign(crewSk, crewHex, cur(), NOW + 1000), opts({ last: { ok: first.record } }));
    expect(again).toMatchObject({ ok: false, code: "reused" });
  });
  it("refuses a wrong code", () => {
    expect(checkSigned(sign(crewSk, crewHex, "AAAAAA"), opts())).toMatchObject({ ok: false, code: "wrong-code" });
  });
  it("refuses a bad signature and a signature for another page", () => {
    const ev = sign(crewSk, crewHex, cur());
    expect(checkSigned({ ...JSON.parse(JSON.stringify(ev)), content: ev.content + "x" }, opts())).toMatchObject({ ok: false, code: "bad-signature" });
    const otherPage = getPublicKey(otherSk);
    expect(checkSigned(sign(crewSk, otherPage, cur()), opts())).toMatchObject({ ok: false, code: "wrong-target" });
  });
  it("refuses a key that is not on the crew, and another event kind", () => {
    expect(checkSigned(sign(crewSk, crewHex, cur()), opts({ onCrew: false }))).toMatchObject({ ok: false, code: "not-crew" });
    expect(checkSigned({ ...sign(crewSk, crewHex, cur()), kind: 1 }, opts())).toMatchObject({ ok: false });
  });
  it("shows waiting, signed, and wrong key on the checker's page", () => {
    const w = windowOf(NOW), c = cur();
    expect(viewFor(crewHex, true, undefined, NOW, undefined, SEC).state).toBe("waiting");
    expect(viewFor(crewHex, true, { ok: { code: c, window: w, eventId: "e", at: "", h: 900_000 } }, NOW, undefined, SEC)).toMatchObject({ state: "signed", signedH: 900_000 });
    expect(viewFor(crewHex, true, { ok: { code: "x", window: w - 1, eventId: "e", at: "", h: 5 } }, NOW, undefined, SEC)).toMatchObject({ state: "waiting", lastSignedH: 5 });
    expect(viewFor(crewHex, true, { wrong: { by: "ab", code: c, window: w, at: "" } }, NOW, undefined, SEC).state).toBe("wrong-key");
    expect(viewFor(crewHex, false, undefined, NOW, undefined, SEC).state).toBe("not-crew");
  });
});
