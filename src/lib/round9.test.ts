import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { applicantFor, crewActionOk, crewFor } from "./crewauth";
import { actionAllowed, makeCrewToken, verifyCrewToken, verifySignedChallenge } from "./operator";
import { lud16FromProfile } from "./profile";
import { face, faceText } from "./liveBft";
import { contactEmail } from "@/components/ContactLine";
import { PAY_TERMS, ROLE_COPY, SHARED_LINE } from "./crew";
import type { Applicant } from "./types";

const k1 = getPublicKey(generateSecretKey()), k2 = getPublicKey(generateSecretKey());
const ap = (id: string, hex: string | null, stage: Applicant["stage"]): Applicant => ({ id, name: id, reach: "", area: "", roles: ["runner"], transport: [], hours: "", why: "", stage, notes: [], createdAt: "", npub: hex ? nip19.npubEncode(hex) : undefined });
const people = [ap("a1", k1, "On the crew"), ap("a2", k2, "Applied"), ap("a3", null, "On the crew")];

describe("crew gate", () => {
  it("an On-the-crew npub is crew, an applicant not on the crew is not, an unknown key is not", () => {
    expect(crewFor(people, k1)?.id).toBe("a1");
    expect(crewFor(people, k2)).toBeNull();
    expect(crewFor(people, getPublicKey(generateSecretKey()))).toBeNull();
    expect(applicantFor(people, k2)?.id).toBe("a2");
  });
  it("crew may do crew actions for themselves only, and nothing else", () => {
    const st = { claims: [{ job: "j1", by: "a1" }, { job: "j2", by: "a3" }], routes: [{ id: "r1", runner: "a1" }], proofs: [{ id: "p1", by: "a1" }] };
    const me = people[0];
    expect(crewActionOk(st, { action: "claimJob", by: "a1" }, me).ok).toBe(true);
    expect(crewActionOk(st, { action: "claimJob", by: "a3" }, me).ok).toBe(false);
    expect(crewActionOk(st, { action: "submitProof", ref: "j1" }, me).ok).toBe(true);
    expect(crewActionOk(st, { action: "submitProof", ref: "j2" }, me).ok).toBe(false);
    expect(crewActionOk(st, { action: "submitProof", route: "r1" }, me).ok).toBe(true);
    expect(crewActionOk(st, { action: "reviewProof", id: "p1" }, me).ok).toBe(false);
    expect(crewActionOk(st, { action: "addInventory" }, me).ok).toBe(false);
  });
  it("the action gate lets crew and operators through and keeps others out", () => {
    process.env.VEND_REQUIRE_OPERATOR = "1";
    expect(actionAllowed("claimJob", false, true).ok).toBe(true);
    expect(actionAllowed("claimJob", false, false)).toMatchObject({ ok: false, error: "Sign in with nostr." });
    expect(actionAllowed("addInventory", false, true).ok).toBe(false); // crew cannot run the admin
    expect(actionAllowed("addInventory", true, false).ok).toBe(true); // operator can do everything
    delete process.env.VEND_REQUIRE_OPERATOR;
  });
  it("crew sign-in checks the signed challenge and the session token", () => {
    process.env.VEND_SESSION_SECRET = "s";
    const sk = generateSecretKey();
    const ev = finalizeEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [], content: `PACS-CREW-${Date.now()}` }, sk);
    expect(verifySignedChallenge(ev, "PACS-CREW")).toMatchObject({ ok: true, pubkey: getPublicKey(sk) });
    expect(verifySignedChallenge(ev, "PACS-CONSOLE").ok).toBe(false);
    const stale = finalizeEvent({ kind: 22242, created_at: 1, tags: [], content: `PACS-CREW-${Date.now() - 3600_000}` }, sk);
    expect(verifySignedChallenge(stale, "PACS-CREW").ok).toBe(false);
    const t = makeCrewToken(k1);
    expect(verifyCrewToken(t)).toBe(k1);
    expect(verifyCrewToken(t.slice(0, -2) + "00")).toBeNull();
    delete process.env.VEND_SESSION_SECRET;
  });
});

describe("lud16 from a nostr profile", () => {
  it("reads a valid address and refuses junk", () => {
    expect(lud16FromProfile(JSON.stringify({ name: "x", lud16: "Pat@Wallet.Example" }))).toBe("pat@wallet.example");
    expect(lud16FromProfile(JSON.stringify({ lud16: "not an address" }))).toBeNull();
    expect(lud16FromProfile(JSON.stringify({ name: "x" }))).toBeNull();
    expect(lud16FromProfile("{broken")).toBeNull();
  });
});

describe("no dollars, no percent in the header, contact line", () => {
  it("the clock text has neither", () => {
    const t = faceText(face({ height: 974004, at: 0, est: false }, 125_000));
    expect(t).not.toMatch(/\$|%|full/);
  });
  it("role cards and the pay line have no dollar sign", () => {
    expect([SHARED_LINE, PAY_TERMS.line, ...Object.values(ROLE_COPY).map((r) => r.body)].join(" ")).not.toContain("$");
  });
  it("the postings feed has no dollar field or sign", async () => {
    const { GET } = await import("@/app/api/crew/postings/route");
    const text = await (await GET(new Request("http://x.test/api/crew/postings"))).text();
    expect(text).not.toMatch(/\$|usd|dollar/i);
    expect(JSON.parse(text).postings[0].pay.satsPerJob).toBeGreaterThan(0);
  });
  it("no visible page source shows a dollar amount", () => {
    const hits: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx$/.test(p) && /\$\d|\$ ?\{?\s*[A-Z]/.test(readFileSync(p, "utf8").replace(/\$\{/g, ""))) hits.push(p); } };
    walk(path.join(process.cwd(), "src", "app"));
    expect(hits).toEqual([]);
  });
  it("the contact line is hidden when VEND_CONTACT_EMAIL is unset and shown when set", () => {
    delete process.env.VEND_CONTACT_EMAIL;
    expect(contactEmail()).toBeNull();
    process.env.VEND_CONTACT_EMAIL = "hello@example.org";
    expect(contactEmail()).toBe("hello@example.org");
    process.env.VEND_CONTACT_EMAIL = "not an email";
    expect(contactEmail()).toBeNull();
    delete process.env.VEND_CONTACT_EMAIL;
  });
});
