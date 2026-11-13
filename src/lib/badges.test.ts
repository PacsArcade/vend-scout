import { describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { BADGES, BADGE_ART, CREW_BADGE, hasRealArt, awardUnsigned, badgeImageUrl, definitionUnsigned } from "./badgedefs";
import { bestOnTimeStreak, earnedBadges, type BadgeSlice } from "./badges";
import { publishSigned, verifyBadgeEvent } from "./badgecheck";
import { ON_TIME_LABEL, STOP_MILESTONES } from "./arcade";
import { pathIsPublic } from "./operator";
import type { Proof } from "./types";

// Test keys live in memory only. Nothing is saved, and the publish function is a mock: no relay is touched.
const opSk = generateSecretKey(), opHex = getPublicKey(opSk), crewHex = getPublicKey(generateSecretKey());
const ORIGIN = "https://example.test";
const NOW = 1_800_000_000_000;
const sign = (u: { kind: number; created_at: number; tags: string[][]; content: string }, sk = opSk) => JSON.parse(JSON.stringify(finalizeEvent(u, sk)));
const proof = (i: number, onTime: boolean): Proof => ({ id: `p${i}`, by: "a1", status: "approved", sentAt: `2026-03-${String(10 + i).padStart(2, "0")}T10:00:00Z`, breakdown: onTime ? [{ label: ON_TIME_LABEL, points: 1 }] : [] } as unknown as Proof);
const slice = (proofs: Proof[], jobs = 0): BadgeSlice => ({
  applicants: [{ id: "a1", name: "Maya", crewName: "maya-g", npub: nip19.npubEncode(crewHex), stage: "On the crew", roles: [], notes: [] }] as never,
  machines: [], routes: [], listings: [], proofs,
  claims: Array.from({ length: jobs }, (_, i) => ({ job: `scout:x${i}`, by: "a1", doneAt: "t" })) as never,
});

describe("badge set", () => {
  it("has the crew badge, the milestone badges from arcade.ts and the on-time streaks", () => {
    expect(BADGES.map((b) => b.d)).toEqual(["vendfrens-crew", ...STOP_MILESTONES.map((n) => `vendfrens-service-${n}`), "vendfrens-ontime-7", "vendfrens-ontime-30", "vendfrens-ontime-100"]);
    expect(BADGE_ART.placeholder).toBe(true);
  });
  it("counts the best on-time run, and a late stop breaks it", () => {
    const ps = [...Array.from({ length: 5 }, (_, i) => proof(i, true)), proof(5, false), ...Array.from({ length: 7 }, (_, i) => proof(6 + i, true))];
    expect(bestOnTimeStreak(ps, "a1")).toBe(7);
  });
  it("awards by service count and streak", () => {
    const got = (st: BadgeSlice) => earnedBadges(st).map((e) => e.badge.d);
    expect(got(slice([], 0))).toEqual(["vendfrens-crew"]);
    expect(got(slice([], 10))).toEqual(["vendfrens-crew", "vendfrens-service-1", "vendfrens-service-10"]);
    expect(got(slice(Array.from({ length: 7 }, (_, i) => proof(i, true)), 0))).toContain("vendfrens-ontime-7");
  });
  it("serves the placeholder art without a sign-in", () => {
    expect(pathIsPublic("/badges/vendfrens-crew.svg", false)).toBe(true);
    expect(pathIsPublic("/admin/badges", false)).toBe(false);
  });
});

describe("publishing an operator signed badge event", () => {
  const earned = earnedBadges(slice([], 1));
  const base = { origin: ORIGIN, earned, operators: [opHex], now: NOW };
  const def = BADGES[0];
  it("accepts a definition signed by an operator and sends it on once", async () => {
    const publish = vi.fn(async () => 2);
    const r = await publishSigned(sign(definitionUnsigned(def, ORIGIN, NOW)), { ...base, publish });
    expect(r).toMatchObject({ ok: true, key: "def:vendfrens-crew" });
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it("accepts an award for someone who earned it", () => {
    const r = verifyBadgeEvent(sign(awardUnsigned(BADGES[1], opHex, crewHex, NOW)), base);
    expect(r).toMatchObject({ ok: true, key: `award:vendfrens-service-1:${crewHex}` });
  });
  it("refuses a key that is not an operator, and sends nothing", async () => {
    const publish = vi.fn(async () => 1);
    const r = await publishSigned(sign(definitionUnsigned(def, ORIGIN, NOW), generateSecretKey()), { ...base, publish });
    expect(r.ok).toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });
  it("refuses a bad signature, changed text, an unearned award and stale events", () => {
    const ev = sign(definitionUnsigned(def, ORIGIN, NOW));
    expect(verifyBadgeEvent({ ...ev, sig: ev.sig.replace(/^./, ev.sig[0] === "a" ? "b" : "a") }, base).ok).toBe(false);
    const changed = sign({ ...definitionUnsigned(def, ORIGIN, NOW), tags: definitionUnsigned(def, ORIGIN, NOW).tags.map((t) => (t[0] === "name" ? ["name", "Free Money"] : t)) });
    expect(verifyBadgeEvent(changed, base)).toMatchObject({ ok: false });
    expect(verifyBadgeEvent(sign(awardUnsigned(BADGES[3], opHex, crewHex, NOW)), base)).toMatchObject({ ok: false, reason: expect.stringMatching(/not earned/) });
    expect(verifyBadgeEvent(sign(awardUnsigned(BADGES[0], opHex, crewHex, NOW - 3_600_000)), base)).toMatchObject({ ok: false });
    expect(verifyBadgeEvent(sign({ kind: 1, created_at: NOW / 1000, tags: [], content: "" }), base)).toMatchObject({ ok: false });
  });
  it("records nothing when no relay took the event", async () => {
    const r = await publishSigned(sign(definitionUnsigned(def, ORIGIN, NOW)), { ...base, publish: async () => 0 });
    expect(r.ok).toBe(false);
  });
  it("builds image addresses from the one art constant", () => {
    expect(badgeImageUrl("vendfrens-service-1", ORIGIN)).toBe(`${ORIGIN}${BADGE_ART.base}/vendfrens-service-1.${BADGE_ART.ext}`);
  });
  it("the crew badge uses the real crew-badge art and its own size, the others stay placeholders", () => {
    expect(badgeImageUrl("vendfrens-crew", ORIGIN)).toBe(`${ORIGIN}${CREW_BADGE.url}`);
    const crew = BADGES.find((b) => b.d === "vendfrens-crew")!;
    expect(definitionUnsigned(crew, ORIGIN, NOW).tags.find((t) => t[0] === "image")).toEqual(["image", `${ORIGIN}${CREW_BADGE.url}`, CREW_BADGE.size]);
    expect(hasRealArt("vendfrens-ontime-7")).toBe(false);
  });
});
