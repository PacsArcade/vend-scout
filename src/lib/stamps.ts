import type { PassportEvent } from "./passport";

// Stamp rarity, both ways he asked for (round 2, board 5). Pure.
// A. Milestones: a gold stamp at set counts. Everyone can see what is coming.
export const VISIT_MILESTONES = [1, 21, 100, 1000];
export const SALE_MILESTONES = [100, 1000, 21000];
// B. On-time streaks: bronze after 3 on-time visits in a row, silver after 7, gold after 21. A late visit starts the count again.
export const STREAK_TIERS: { at: number; tier: "bronze" | "silver" | "gold" }[] = [{ at: 21, tier: "gold" }, { at: 7, tier: "silver" }, { at: 3, tier: "bronze" }];

export const isMilestoneVisit = (n: number) => VISIT_MILESTONES.includes(n);
export const nextMilestone = (n: number, list = VISIT_MILESTONES) => list.find((m) => m > n) ?? null;
export function streakTier(run: number): "bronze" | "silver" | "gold" | null { return STREAK_TIERS.find((t) => run >= t.at)?.tier ?? null; }

export interface VisitStamp { n: number; event: PassportEvent; milestone: boolean; onTime: boolean | null; run: number; tier: "bronze" | "silver" | "gold" | null }
/** Service visits (a restock or a route stop), oldest first, numbered from 1.
 * onTime comes from the job's due block. The app does not store a due block yet, so a visit says null (not known) and does not count toward or break a streak. */
export function visitStamps(events: PassportEvent[], onTimeOf?: (e: PassportEvent) => boolean | null): VisitStamp[] {
  let run = 0;
  return events.filter((e) => e.kind === "restock" || e.kind === "stop").map((event, i) => {
    const onTime = onTimeOf ? onTimeOf(event) : null;
    if (onTime === true) run++; else if (onTime === false) run = 0;
    return { n: i + 1, event, milestone: isMilestoneVisit(i + 1), onTime, run, tier: onTime === true ? streakTier(run) : null };
  });
}
