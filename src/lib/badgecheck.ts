import { verifyEvent } from "nostr-tools";
import { BADGE_AWARD_KIND, BADGE_DEFINITION_KIND, BADGES, awardKey, awardTags, badgeByD, defKey, definitionTags } from "./badgedefs";
import type { Earned } from "./badges";
import { operatorHexKeys } from "./operator";
import type { BadgePublished } from "./types";

type Ev = { id?: string; pubkey?: string; sig?: string; kind?: number; created_at?: number; tags?: string[][]; content?: string };
const same = (a: string[][], b: string[][]) => a.length === b.length && a.every((t, i) => t.length === b[i].length && t.every((x, j) => x === b[i][j]));

export type BadgeCheck = { ok: true; key: string; pubkey: string; kind: number } | { ok: false; reason: string };

/**
 * Check one signed badge event before it is sent on. The app never signs: the operator's own signer did.
 * Good only when: the signature is valid, the key is on the operator list, the event is fresh, and it is EXACTLY one of our definitions
 * (same tags as the code builds) or an award that names our definition under the signer's key for a person who has earned it.
 */
export function verifyBadgeEvent(ev: Ev, o: { origin: string; earned: Earned[]; operators?: string[]; now?: number }): BadgeCheck {
  const ops = o.operators ?? operatorHexKeys(), now = o.now ?? Date.now();
  if (!ev || !ev.pubkey || !ev.sig || !Array.isArray(ev.tags) || typeof ev.content !== "string") return { ok: false, reason: "A signed event is needed" };
  try { if (!verifyEvent(ev as never)) return { ok: false, reason: "The signature check failed" }; } catch { return { ok: false, reason: "The signature check failed" }; }
  if (!ops.includes(ev.pubkey)) return { ok: false, reason: "That key is not on this site's operator list" };
  if (Math.abs(now / 1000 - (ev.created_at ?? 0)) > 600) return { ok: false, reason: "That event is too old. Sign it again" };
  if (ev.content !== "") return { ok: false, reason: "Badge events carry no content" };
  if (ev.kind === BADGE_DEFINITION_KIND) {
    const d = ev.tags.find((t) => t[0] === "d")?.[1] ?? "";
    const b = badgeByD(d);
    if (!b) return { ok: false, reason: "That is not one of our badges" };
    if (!same(ev.tags, definitionTags(b, o.origin))) return { ok: false, reason: "The badge text or art changed since you signed. Reload and sign again" };
    return { ok: true, key: defKey(d), pubkey: ev.pubkey, kind: ev.kind };
  }
  if (ev.kind === BADGE_AWARD_KIND) {
    const a = ev.tags.find((t) => t[0] === "a")?.[1] ?? "", p = ev.tags.find((t) => t[0] === "p")?.[1] ?? "";
    const d = a.split(":")[2] ?? "";
    const b = BADGES.find((x) => x.d === d);
    if (!b || !same(ev.tags, awardTags(b, ev.pubkey, p))) return { ok: false, reason: "That award does not name one of our badges under your key" };
    if (!o.earned.some((e) => e.badge.d === d && e.hex === p)) return { ok: false, reason: "That person has not earned this badge" };
    return { ok: true, key: awardKey(d, p), pubkey: ev.pubkey, kind: ev.kind };
  }
  return { ok: false, reason: "Only badge definitions and awards are accepted" };
}

/** Verify, send to the relays through the given function, and say what to record. Nothing is sent unless the check passes, and nothing is recorded unless a relay took it. */
export async function publishSigned(ev: Ev, o: { origin: string; earned: Earned[]; operators?: string[]; now?: number; publish: (ev: Ev) => Promise<number>; h?: number }): Promise<{ ok: true; key: string; rec: BadgePublished } | { ok: false; reason: string }> {
  const v = verifyBadgeEvent(ev, o);
  if (!v.ok) return v;
  const relays = await o.publish(ev);
  if (relays === 0) return { ok: false, reason: "No relay accepted it. Nothing was recorded. Try again" };
  return { ok: true, key: v.key, rec: { eventId: String(ev.id), kind: v.kind, by: v.pubkey, at: new Date(o.now ?? Date.now()).toISOString(), h: o.h, relays } };
}
