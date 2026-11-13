import { verifyEvent } from "nostr-tools";
import { validLightning } from "./lightning";

// Nostr profiles (kind 0), browser side. One relay door for the whole app: read, merge, publish.
// The server never sees a private key. Signing is the user's own NIP-07 signer (window.nostr).
export const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

/** Pure part: pull a valid Lightning address out of kind 0 content. Anything odd gives null. */
export function lud16FromProfile(content: string): string | null {
  try {
    const j = JSON.parse(content) as { lud16?: unknown };
    if (typeof j.lud16 !== "string") return null;
    const v = validLightning(j.lud16);
    return v.ok && v.value.includes("@") ? v.value : null;
  } catch { return null; }
}

// ---- Parse a kind 0 safely ----
export interface Kind0 { name: string; display_name: string; picture: string; banner: string; about: string; nip05: string; lud16: string; website: string }
export const KIND0_FIELDS = ["name", "display_name", "picture", "banner", "about", "nip05", "lud16", "website"] as const;
export type Kind0Field = (typeof KIND0_FIELDS)[number];
/** Longest allowed value per field. Longer values are cut, not rejected. */
export const KIND0_MAX: Record<Kind0Field, number> = { name: 60, display_name: 80, picture: 500, banner: 500, about: 600, nip05: 100, lud16: 100, website: 200 };
export const EMPTY_KIND0: Kind0 = { name: "", display_name: "", picture: "", banner: "", about: "", nip05: "", lud16: "", website: "" };
const URL_FIELDS: Kind0Field[] = ["picture", "banner", "website"];

/** An https address with no spaces and no credentials, or "". http, data:, javascript: and the rest are refused. */
export function httpsOnly(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!s || s.length > max || /\s/.test(s)) return "";
  try { const u = new URL(s); return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") ? u.toString() : ""; } catch { return ""; }
}
// Strips control characters (kept as one range, written with escapes) so a profile cannot smuggle odd text.
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "");

/** Pure parser. Bad JSON or a non-object gives an all-empty profile. Image and website fields must be https. */
export function parseKind0(content: string): Kind0 {
  let j: unknown;
  try { j = JSON.parse(content); } catch { return { ...EMPTY_KIND0 }; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return { ...EMPTY_KIND0 };
  const o = j as Record<string, unknown>;
  const out = { ...EMPTY_KIND0 };
  for (const f of KIND0_FIELDS) out[f] = URL_FIELDS.includes(f) ? httpsOnly(o[f], KIND0_MAX[f]) : clean(o[f], KIND0_MAX[f]);
  return out;
}

// ---- Merge an edit onto the latest kind 0 so no unknown field is lost ----
export interface NostrEvent { id?: string; pubkey?: string; created_at: number; kind: number; tags: string[][]; content: string; sig?: string }
/** Keep every key the latest profile had (even ones we do not know). Edited fields replace; an empty edit removes the field. Returns the content JSON. */
export function mergeKind0(latestContent: string | null | undefined, edits: Partial<Kind0>): string {
  let base: Record<string, unknown> = {};
  try { const j = JSON.parse(latestContent ?? ""); if (j && typeof j === "object" && !Array.isArray(j)) base = j as Record<string, unknown>; } catch { base = {}; }
  const merged: Record<string, unknown> = { ...base };
  for (const f of KIND0_FIELDS) {
    if (!(f in edits)) continue;
    const raw = edits[f];
    const v = URL_FIELDS.includes(f) ? httpsOnly(raw, KIND0_MAX[f]) : clean(raw, KIND0_MAX[f]);
    if (v) merged[f] = v; else delete merged[f];
  }
  return JSON.stringify(merged);
}
/** The unsigned kind 0 event for the signer. Tags of the latest event are kept. The signer adds pubkey, id and sig. */
export function buildKind0Event(latest: NostrEvent | null, edits: Partial<Kind0>, nowSec = Math.floor(Date.now() / 1000)): NostrEvent {
  const prev = latest?.created_at ?? 0;
  return { kind: 0, created_at: Math.max(nowSec, prev + 1), tags: latest?.tags?.map((t) => [...t]) ?? [], content: mergeKind0(latest?.content, edits) };
}

// ---- NIP-05 ----
export function parseNip05(id: string): { name: string; domain: string } | null {
  const s = id.trim().toLowerCase();
  const m = s.match(/^(?:([a-z0-9._-]+)@)?([a-z0-9.-]+\.[a-z]{2,})$/);
  return m ? { name: m[1] ?? "_", domain: m[2] } : null;
}
export const nip05Url = (p: { name: string; domain: string }) => `https://${p.domain}/.well-known/nostr.json?name=${encodeURIComponent(p.name)}`;
/** Pure check of the nostr.json answer against the key. */
export function nip05Matches(json: unknown, name: string, pubkeyHex: string): boolean {
  const names = (json as { names?: Record<string, unknown> } | null)?.names;
  return !!names && typeof names === "object" && typeof names[name] === "string" && (names[name] as string).toLowerCase() === pubkeyHex.toLowerCase();
}
export type Nip05State = "verified" | "not verified" | "unreachable" | "none";
/** Browser side, short timeout. "unreachable" means the domain did not answer (CORS, offline, slow), which is not proof either way. */
export async function verifyNip05(nip05: string, pubkeyHex: string, timeoutMs = 3500, f: typeof fetch = fetch): Promise<Nip05State> {
  if (!nip05) return "none";
  const p = parseNip05(nip05);
  if (!p) return "not verified";
  try {
    const r = await f(nip05Url(p), { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
    if (!r.ok) return "not verified";
    return nip05Matches(await r.json(), p.name, pubkeyHex) ? "verified" : "not verified";
  } catch { return "unreachable"; }
}

// ---- Relays ----
/** Newest kind 0 across the relays. Resolves when every relay has answered or the time is up. Events with a bad signature are dropped. */
export async function fetchKind0Event(pubkey: string, timeoutMs = 4000): Promise<NostrEvent | null> {
  return new Promise((resolve) => {
    let done = false, pending = RELAYS.length;
    let best: NostrEvent | null = null;
    const socks: WebSocket[] = [];
    const finish = () => { if (done) return; done = true; clearTimeout(timer); for (const s of socks) { try { s.close(); } catch { /* closed */ } } resolve(best); };
    const timer = setTimeout(finish, timeoutMs);
    const one = () => { if (--pending === 0) finish(); };
    for (const url of RELAYS) {
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { one(); continue; }
      socks.push(ws);
      let counted = false;
      const count = () => { if (!counted) { counted = true; one(); } };
      ws.onopen = () => ws.send(JSON.stringify(["REQ", "vsprof", { kinds: [0], authors: [pubkey], limit: 1 }]));
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data)) as unknown[];
          if (msg[0] === "EVENT" && msg[2]) {
            const ev = msg[2] as NostrEvent;
            if (ev.kind === 0 && ev.pubkey === pubkey && typeof ev.content === "string" && verifyEvent(ev as never) && (!best || ev.created_at > best.created_at)) best = ev;
          } else if (msg[0] === "EOSE") count();
        } catch { /* ignore */ }
      };
      ws.onerror = count; ws.onclose = count;
    }
  });
}
export async function fetchLud16(pubkey: string, timeoutMs = 4000): Promise<string | null> {
  const ev = await fetchKind0Event(pubkey, timeoutMs);
  return ev ? lud16FromProfile(ev.content) : null;
}

export interface RelayResult { relay: string; ok: boolean; message: string }
/** Send a signed event to every relay and report OK or fail for each. */
export function publishEvent(ev: unknown, timeoutMs = 5000): Promise<RelayResult[]> {
  const id = (ev as { id?: string }).id;
  return Promise.all(RELAYS.map((relay) => new Promise<RelayResult>((resolve) => {
    let ws: WebSocket;
    let settled = false;
    const end = (ok: boolean, message: string) => { if (settled) return; settled = true; clearTimeout(t); try { ws?.close(); } catch { /* closed */ } resolve({ relay, ok, message }); };
    const t = setTimeout(() => end(false, "no answer in time"), timeoutMs);
    try { ws = new WebSocket(relay); } catch { return end(false, "could not connect"); }
    ws.onopen = () => ws.send(JSON.stringify(["EVENT", ev]));
    ws.onmessage = (m) => { try { const msg = JSON.parse(String(m.data)) as unknown[]; if (msg[0] === "OK" && msg[1] === id) end(msg[2] === true, String(msg[3] ?? "")); } catch { /* ignore */ } };
    ws.onerror = () => end(false, "could not connect");
  })));
}
