import crypto from "crypto";
import { nip19, verifyEvent } from "nostr-tools";

// Operator sign-in, ported from frens.earth (src/lib/operator-auth.ts). Copied, not imported.
// The operator IS a key: sign a fresh challenge with a key on the OPERATOR_NPUBS list (comma separated).
// The session is an HMAC token in an httpOnly cookie, signed with VEND_SESSION_SECRET.
export const OPERATOR_COOKIE = "vs-operator";
export const CREW_COOKIE = "vs-crew";
export const NEIGHBOR_COOKIE = "vs-neighbor";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

/** The gate is on for the live site (Vercel) and whenever VEND_REQUIRE_OPERATOR=1. Local dev and tests stay open. */
export const gateOn = () => process.env.VERCEL === "1" || process.env.VEND_REQUIRE_OPERATOR === "1";

const secret = () => { const s = process.env.VEND_SESSION_SECRET?.trim(); if (!s) throw new Error("VEND_SESSION_SECRET not configured"); return s; };
const hmac = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("hex");

export function operatorHexKeys(): string[] {
  return (process.env.OPERATOR_NPUBS ?? "").split(",").map((n) => {
    try { const d = nip19.decode(n.trim()); return d.type === "npub" ? (d.data as string) : null; } catch { return null; }
  }).filter((k): k is string => !!k);
}
export const operatorsConfigured = () => operatorHexKeys().length > 0;

/** A signed fresh challenge from ANY key (the crew door). Who the key belongs to is decided by the applicant list, not here. */
export function verifySignedChallenge(event: { content?: string; pubkey?: string; sig?: string; kind?: number; created_at?: number; tags?: unknown; id?: string }, prefix: string, now = Date.now()): { ok: true; pubkey: string } | { ok: false; reason: string } {
  if (!event?.content || !event.pubkey || !event.sig) return { ok: false, reason: "A signed challenge is needed" };
  const m = event.content.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!m) return { ok: false, reason: "That is not a sign-in challenge" };
  if (Math.abs(now - Number(m[1])) > CHALLENGE_WINDOW_MS) return { ok: false, reason: "The challenge expired. Sign a fresh one" };
  if (!verifyEvent(event as any)) return { ok: false, reason: "The signature check failed" };
  return { ok: true, pubkey: event.pubkey };
}

export function npubToHex(npub: string): string | null {
  try { const d = nip19.decode(npub.trim()); return d.type === "npub" ? (d.data as string) : null; } catch { return null; }
}

/** Crew session token: proves a key signed in. Whether that key is still On the crew is checked against the applicant list on every use. */
export function makeCrewToken(pubkey: string, now = Date.now()): string {
  const exp = now + SESSION_TTL_MS;
  return `${pubkey}.${exp}.${hmac(`crew|${pubkey}|${exp}`)}`;
}
export function verifyCrewToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null;
  const [pubkey, exp, sig] = token.split(".");
  if (!pubkey || !exp || !sig || now > Number(exp)) return null;
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac(`crew|${pubkey}|${exp}`)))) return null; } catch { return null; }
  return pubkey;
}
export function crewPubkeyFromCookieHeader(header: string | null): string | null {
  const m = (header ?? "").match(new RegExp(`${CREW_COOKIE}=([^;]+)`));
  return verifyCrewToken(m?.[1]);
}

export function verifyOperatorLogin(event: { content?: string; pubkey?: string; sig?: string; kind?: number; created_at?: number; tags?: unknown; id?: string }, now = Date.now()): { ok: true; pubkey: string } | { ok: false; reason: string } {
  if (!event?.content || !event.pubkey || !event.sig) return { ok: false, reason: "A signed challenge is needed" };
  const m = event.content.match(/^PACS-CONSOLE-(\d+)$/);
  if (!m) return { ok: false, reason: "That is not a sign-in challenge" };
  if (Math.abs(now - Number(m[1])) > CHALLENGE_WINDOW_MS) return { ok: false, reason: "The challenge expired. Sign a fresh one" };
  if (!operatorHexKeys().includes(event.pubkey)) return { ok: false, reason: "That key is not on this site's operator list" };
  if (!verifyEvent(event as any)) return { ok: false, reason: "The signature check failed" };
  return { ok: true, pubkey: event.pubkey };
}

export function makeOperatorToken(pubkey: string, now = Date.now()): string {
  const exp = now + SESSION_TTL_MS;
  return `${pubkey}.${exp}.${hmac(`${pubkey}|${exp}`)}`;
}
export function verifyOperatorToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null;
  const [pubkey, exp, sig] = token.split(".");
  if (!pubkey || !exp || !sig || now > Number(exp)) return null;
  try {
    const expected = hmac(`${pubkey}|${exp}`);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  return operatorHexKeys().includes(pubkey) ? pubkey : null;
}
export function operatorFromCookieHeader(header: string | null): string | null {
  const m = (header ?? "").match(new RegExp(`${OPERATOR_COOKIE}=([^;]+)`));
  return verifyOperatorToken(m?.[1]);
}

/** Which /api/do actions anyone may send. Everything else needs an operator when the gate is on. */
export const PUBLIC_ACTIONS = ["apply", "hostPick"];
/** Crew actions: operator-only on the live site until crew sign-in exists. */
export const CREW_ACTIONS = ["goOnline", "passJob", "scheduleBlock", "onboard", "claimJob", "submitProof", "ackPop", "setLeaderboard", "routeRunner"];
export const SIGN_IN_LINE = "Sign in with nostr. You need a nostr signer, like the nos2x or Alby browser extension.";
export function actionAllowed(action: string, isOperator: boolean, isCrew = false): { ok: true } | { ok: false; status: number; error: string } {
  if (!gateOn() || isOperator || PUBLIC_ACTIONS.includes(action)) return { ok: true };
  if (CREW_ACTIONS.includes(action)) return isCrew ? { ok: true } : { ok: false, status: 403, error: "Sign in with nostr." };
  return { ok: false, status: 401, error: "Operators only. Sign in first." };
}

/** Paths anyone may open when the gate is on. Everything else needs an operator. */
const PUBLIC_PAGES = [/^\/$/, /^\/scout$/, /^\/crew$/, /^\/crew\/apply$/, /^\/crew\/signin$/, /^\/host\/[^/]+$/, /^\/vote\/[^/]+$/, /^\/pay\/[^/]+\/[^/]+$/, /^\/signin$/, /^\/m\/[^/]+$/];
const PUBLIC_API = [/^\/api\/crew\/postings$/, /^\/api\/chain\/tip$/, /^\/api\/place$/, /^\/api\/do$/, /^\/api\/admin\/session$/, /^\/api\/crew\/session$/, /^\/api\/scout$/, /^\/api\/scout\/pins$/, /^\/api\/scout\/stream$/, /^\/api\/m\/[^/]+\/photo$/, /^\/api\/neighbor\/(session|act)$/, /^\/api\/zap\/invoice$/, /^\/api\/cron\/scan$/];
export function pathIsPublic(pathname: string, isApi: boolean): boolean {
  return (isApi ? PUBLIC_API : PUBLIC_PAGES).some((r) => r.test(pathname));
}
/** Crew pages say "sign-in is coming soon" instead of a bare operator gate. */
export const isCrewPath = (p: string) => /^\/(work|run|jobs)(\/|$)/.test(p);

/** Paths a signed-in crew member (not an operator) may also use. */
export const isCrewOnlyApi = (p: string) => p === "/api/offers" || p === "/api/stopphoto" || p === "/api/crew/dm";

/** Neighbor session: any nostr key that signed a fresh challenge. It only lets that key verify, report, request and share. */
export function makeNeighborToken(pubkey: string, now = Date.now()): string {
  const exp = now + 30 * 24 * 60 * 60 * 1000;
  return `${pubkey}.${exp}.${hmac(`nb|${pubkey}|${exp}`)}`;
}
export function verifyNeighborToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null;
  const [pubkey, exp, sig] = token.split(".");
  if (!pubkey || !exp || !sig || now > Number(exp)) return null;
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac(`nb|${pubkey}|${exp}`)))) return null; } catch { return null; }
  return pubkey;
}
export function neighborFromCookieHeader(header: string | null): string | null {
  const m = (header ?? "").match(new RegExp(`${NEIGHBOR_COOKIE}=([^;]+)`));
  return verifyNeighborToken(m?.[1]);
}
