import { afterEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { actionAllowed, isCrewPath, makeOperatorToken, pathIsPublic, verifyOperatorLogin, verifyOperatorToken } from "./operator";
import { allow, resetLimits } from "./ratelimit";
import { checkProof, SKIP_REASON } from "./autoCheck";

const sk = generateSecretKey();
const pk = getPublicKey(sk);
const setEnv = () => { process.env.OPERATOR_NPUBS = `${nip19.npubEncode(pk)}, npub1notvalid`; process.env.VEND_SESSION_SECRET = "test-secret"; process.env.VEND_REQUIRE_OPERATOR = "1"; };
afterEach(() => { delete process.env.VEND_REQUIRE_OPERATOR; delete process.env.OPERATOR_NPUBS; delete process.env.VEND_SESSION_SECRET; vi.unstubAllEnvs(); });

describe("operator gate", () => {
  it("is open locally and closed with the gate on", () => {
    expect(actionAllowed("addInventory", false).ok).toBe(true);
    setEnv();
    expect(actionAllowed("addInventory", false)).toMatchObject({ ok: false, status: 401 });
    expect(actionAllowed("reviewProof", false).ok).toBe(false);
    expect(actionAllowed("addInventory", true).ok).toBe(true);
  });
  it("crew actions say sign in with nostr, and the public ones pass", () => {
    setEnv();
    for (const a of ["claimJob", "submitProof", "goOnline"]) expect(actionAllowed(a, false)).toMatchObject({ ok: false, error: "Sign in with nostr." });
    expect(actionAllowed("apply", false).ok).toBe(true);
    expect(actionAllowed("hostPick", false).ok).toBe(true);
  });
  it("admin and contact pages are not public, the public ones are", () => {
    for (const p of ["/admin", "/admin/ai-check", "/prospects/osm-n1", "/crew/applicants", "/machines/m1", "/orders", "/shelf"]) expect(pathIsPublic(p, false)).toBe(false);
    for (const p of ["/", "/scout", "/crew", "/crew/apply", "/host/osm-n1", "/vote/m1", "/pay/m1/A1"]) expect(pathIsPublic(p, false)).toBe(true);
    for (const p of ["/api/contacts", "/api/stopphoto/r1-1.png", "/api/mylistings", "/api/offers", "/api/ai-check"]) expect(pathIsPublic(p, true)).toBe(false);
    for (const p of ["/api/crew/postings", "/api/chain/tip", "/api/place"]) expect(pathIsPublic(p, true)).toBe(true);
    expect(isCrewPath("/work/earnings")).toBe(true);
  });
  it("signs in with an allowlisted key and rejects others, stale challenges and bad tokens", () => {
    setEnv();
    const ev = finalizeEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [], content: `PACS-CONSOLE-${Date.now()}` }, sk);
    expect(verifyOperatorLogin(ev)).toMatchObject({ ok: true, pubkey: pk });
    const other = finalizeEvent({ kind: 22242, created_at: 1, tags: [], content: `PACS-CONSOLE-${Date.now()}` }, generateSecretKey());
    expect(verifyOperatorLogin(other).ok).toBe(false);
    const stale = finalizeEvent({ kind: 22242, created_at: 1, tags: [], content: `PACS-CONSOLE-${Date.now() - 3600_000}` }, sk);
    expect(verifyOperatorLogin(stale).ok).toBe(false);
    const tok = makeOperatorToken(pk);
    expect(verifyOperatorToken(tok)).toBe(pk);
    expect(verifyOperatorToken(tok.slice(0, -2) + "aa")).toBeNull();
    expect(verifyOperatorToken(makeOperatorToken(pk, 0), Date.now())).toBeNull(); // expired
  });
});

describe("apply rate limit and honeypot", () => {
  it("allows five an hour from one place, then refuses", () => {
    resetLimits();
    for (let i = 0; i < 5; i++) expect(allow("ip1", 5, 3600_000, 1000 + i)).toBe(true);
    expect(allow("ip1", 5, 3600_000, 2000)).toBe(false);
    expect(allow("ip2", 5, 3600_000, 2000)).toBe(true);
    expect(allow("ip1", 5, 3600_000, 1000 + 3600_001 + 5)).toBe(true);
  });
});

describe("checker skips without OLLAMA_URL", () => {
  it("goes straight to needs-human and never calls the network", async () => {
    vi.stubEnv("OLLAMA_URL", "");
    let called = false;
    const f = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
    const v = await checkProof({ before: "a.png", after: "b.png", loadItems: [{ slot: "A1", item: "x" }] }, { fetchImpl: f, readPhoto: async () => "AAAA" });
    expect(v.overall).toBe("needs-human");
    expect(v.error).toBe(SKIP_REASON);
    expect(v.ms).toBeLessThan(50);
    expect(called).toBe(false);
  });
});

describe("apply honeypot", () => {
  it("a filled hidden field saves nothing", async () => {
    const os = await import("os"), path = await import("path"), { promises: fs } = await import("fs");
    const f = path.join(os.tmpdir(), `vend-hp-${process.pid}.json`);
    await fs.writeFile(f, "{}");
    process.env.VEND_STATE_FILE = f;
    const { perform, readState } = await import("./store");
    const base = { action: "apply" as const, name: "Bot", reach: "bot@x.co", area: "x", roles: ["runner" as const], transport: [], hours: "", why: "" };
    expect((await perform({ ...base, hp: "http://spam" })).ok).toBe(true);
    expect((await readState()).applicants.length).toBe(0);
    expect((await perform(base)).ok).toBe(true);
    expect((await readState()).applicants.length).toBe(1);
  });
});
