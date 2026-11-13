import { ON_TIME_LABEL } from "./arcade";
import { BADGES, awardKey, defKey, type BadgeDef } from "./badgedefs";
import { npubToHex } from "./operator";
import type { BadgePublished, Proof } from "./types";
import { summaryFor, type Slice } from "./vendprofile";

// Who has earned which badge. Pure: computed from records the store already keeps. Nothing is stored here.
export interface Earned { badge: BadgeDef; hex: string; name: string; value?: number }
export interface BadgeSlice extends Slice { proofs: Proof[]; badgePublished?: Record<string, BadgePublished> }

/** The longest run of approved stops in a row (oldest first) that were each finished on time in the worker's block. */
export function bestOnTimeStreak(proofs: Proof[], by: string): number {
  const mine = proofs.filter((p) => p.by === by && p.status === "approved").sort((a, b) => (a.approvedAt ?? a.sentAt).localeCompare(b.approvedAt ?? b.sentAt));
  let best = 0, run = 0;
  for (const p of mine) { run = p.breakdown?.some((x) => x.label === ON_TIME_LABEL) ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

/** Awards due for every person On the crew who has a linked key. The service count is the same one the crew profile shows (jobsDone). */
export function earnedBadges(st: BadgeSlice): Earned[] {
  const out: Earned[] = [];
  for (const ap of st.applicants) {
    const hex = ap.stage === "On the crew" && ap.npub ? npubToHex(ap.npub) : null;
    if (!hex) continue;
    const s = summaryFor(st, hex), streak = bestOnTimeStreak(st.proofs, ap.id), name = ap.crewName || ap.name;
    for (const b of BADGES) {
      const value = b.group === "service" ? s.jobsDone : b.group === "ontime" ? streak : undefined;
      if (b.group === "crew" || (b.threshold !== undefined && (value ?? 0) >= b.threshold)) out.push({ badge: b, hex, name, value });
    }
  }
  return out;
}
export const earnedFor = (st: BadgeSlice, hex: string) => earnedBadges(st).filter((e) => e.hex === hex);
export const publishedAward = (st: Pick<BadgeSlice, "badgePublished">, d: string, hex: string) => st.badgePublished?.[awardKey(d, hex)];
export const publishedDef = (st: Pick<BadgeSlice, "badgePublished">, d: string) => st.badgePublished?.[defKey(d)];
