import crypto from "crypto";
import { verifyEvent } from "nostr-tools";
import type { VerifyRecord } from "./types";
import { VERIFY_KIND, VERIFY_WINDOW_S, verifyContent } from "./verifyevent";

// The signed one-time code. A checker opens /verify/<npub> and reads a short code. The crew member signs it with their own key.
// The code is STATELESS: HMAC(server secret, "vend-verify-code|<key>|<window number>") cut to 6 easy letters and digits. No code is stored.
// What is stored (State.verifySigs) is only the result: the last code that was signed, so it cannot be used twice.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0 O 1 I L
const GRACE_S = 20; // a code signed just as its window ends still counts
const SKEW_S = VERIFY_WINDOW_S + GRACE_S;

let devSecret: string | null = null;
/** VEND_SESSION_SECRET (same name the cookies use). Local dev with none set gets a random secret per run. On Vercel a missing secret is an error. */
function secret(): string {
  const s = process.env.VEND_SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.VERCEL === "1") throw new Error("VEND_SESSION_SECRET not configured");
  return (devSecret ??= crypto.randomBytes(24).toString("hex"));
}
export const windowOf = (nowMs: number) => Math.floor(nowMs / 1000 / VERIFY_WINDOW_S);

export function codeFor(hex: string, window: number, sec = secret()): string {
  const d = crypto.createHmac("sha256", sec).update(`vend-verify-code|${hex}|${window}`).digest();
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[d[i] % ALPHABET.length];
  return out;
}

export interface Issued { code: string; window: number; secondsLeft: number }
export function issue(hex: string, nowMs = Date.now(), sec?: string): Issued {
  const window = windowOf(nowMs);
  return { code: codeFor(hex, window, sec), window, secondsLeft: Math.max(0, Math.ceil(((window + 1) * VERIFY_WINDOW_S * 1000 - nowMs) / 1000)) };
}

type Ev = { id?: string; pubkey?: string; sig?: string; kind?: number; created_at?: number; tags?: string[][]; content?: string };
export type CheckResult =
  | { ok: true; record: NonNullable<VerifyRecord["ok"]> }
  | { ok: false; reason: string; code?: "bad-event" | "bad-signature" | "wrong-target" | "wrong-key" | "expired" | "wrong-code" | "stale" | "reused" | "not-crew"; wrong?: NonNullable<VerifyRecord["wrong"]> };

/**
 * Check one signed code event for one page (targetHex is the key in the page address).
 * Good only when: the signature is valid, the event names this page's key and the pubkey IS that key, the code is the one issued
 * for this key and has not expired, created_at is inside the window, the key is On the crew, and this code was not used before.
 */
export function checkSigned(ev: Ev, o: { targetHex: string; onCrew: boolean; last?: VerifyRecord; now?: number; secret?: string }): CheckResult {
  const now = o.now ?? Date.now(), sec = o.secret;
  if (!ev || ev.kind !== VERIFY_KIND || typeof ev.pubkey !== "string" || !ev.sig || typeof ev.content !== "string" || !Array.isArray(ev.tags)) return { ok: false, code: "bad-event", reason: "A signed code is needed" };
  try { if (!verifyEvent(ev as never)) return { ok: false, code: "bad-signature", reason: "The signature check failed" }; } catch { return { ok: false, code: "bad-signature", reason: "The signature check failed" }; }
  const code = ev.tags.find((t) => t[0] === "code")?.[1] ?? "";
  const target = ev.tags.find((t) => t[0] === "p")?.[1];
  if (target !== o.targetHex || ev.content !== verifyContent(o.targetHex, code)) return { ok: false, code: "wrong-target", reason: "That signature is for a different page" };
  if (Math.abs(now / 1000 - (ev.created_at ?? 0)) > SKEW_S) return { ok: false, code: "stale", reason: "That signature is too old. Sign the code on the page again" };
  const w = windowOf(now);
  // The code of this window, or of the last one when it ended only a moment ago.
  const open = [w, ...(now / 1000 - w * VERIFY_WINDOW_S < GRACE_S ? [w - 1] : [])];
  const win = open.find((x) => codeFor(o.targetHex, x, sec) === code);
  if (win === undefined) {
    const past = Array.from({ length: 10 }, (_, i) => w - 1 - i).some((x) => codeFor(o.targetHex, x, sec) === code);
    return past ? { ok: false, code: "expired", reason: "That code expired. A new code is on the page" } : { ok: false, code: "wrong-code", reason: "That is not the code on this page" };
  }
  if (ev.pubkey !== o.targetHex) return { ok: false, code: "wrong-key", reason: "That signature is from a different key, not the crew key on this page", wrong: { by: ev.pubkey, code, window: win, at: new Date(now).toISOString() } };
  if (!o.onCrew) return { ok: false, code: "not-crew", reason: "Not on the crew" };
  if (o.last?.ok && o.last.ok.window === win && o.last.ok.code === code) return { ok: false, code: "reused", reason: "That code was already used. Wait for the next one" };
  return { ok: true, record: { code, window: win, eventId: String(ev.id), at: new Date(now).toISOString() } };
}

export type VerifyState = "waiting" | "signed" | "wrong-key" | "not-crew";
export interface VerifyView {
  state: VerifyState; code: string; window: number; secondsLeft: number;
  signedH?: number; // block height of the signature, for the current code
  lastSignedH?: number; // block height of an earlier signature (its code has expired)
  wrongBy?: string; // npub of the other key
}
/** What the checker's page shows right now. Pure: give it the stored record. */
export function viewFor(hex: string, onCrew: boolean, rec: VerifyRecord | undefined, nowMs = Date.now(), npubOf: (hex: string) => string = (h) => h, sec?: string): VerifyView {
  const cur = issue(hex, nowMs, sec);
  const base = { code: cur.code, window: cur.window, secondsLeft: cur.secondsLeft };
  if (!onCrew) return { ...base, state: "not-crew" };
  const ok = rec?.ok, wrong = rec?.wrong;
  if (ok && ok.window === cur.window) return { ...base, state: "signed", signedH: ok.h ?? 0 };
  if (wrong && wrong.window === cur.window && (!ok || ok.window !== cur.window)) return { ...base, state: "wrong-key", wrongBy: npubOf(wrong.by), lastSignedH: ok?.h };
  return { ...base, state: "waiting", lastSignedH: ok?.h };
}
