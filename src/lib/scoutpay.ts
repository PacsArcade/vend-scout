// Place Scout pay, in three parts (the Admiral's ruling, block 974,078):
//   deal    $25 when the deal is set (the host says yes: the Yes step on the track)
//   placed  $25 when the machine goes in
//   day60   $50 at day 60 if the machine's net sales reach $800 a month (trailing 30 days here)
// Pay after proof stays the rule: a part that is due only SHOWS in admin. Nothing pays itself. The operator approves each one.
// If the scout is no longer On the crew when a part comes due, that part is forfeited and the house keeps it. It is never paid.
import { RATES, netOf, satsToUsd, usdToSats } from "./rates";
import { STAGES } from "./types";
import type { State } from "./store";

export type ScoutPart = "deal" | "placed" | "day60";
export const PART_USD: Record<ScoutPart, number> = { deal: RATES.scoutDealUsd, placed: RATES.scoutPlacedUsd, day60: RATES.scoutDay60Usd };
export const PART_LABEL: Record<ScoutPart, string> = { deal: "Deal set", placed: "Machine placed", day60: "Day 60 bonus" };
export const FORFEIT_LINE = "Forfeited, scout left the crew";
export interface ScoutReward { key: string; prospect: string; scout: string; part: ScoutPart; usd: number; state: "due" | "paid" | "forfeited"; sats?: number }

const DAY = 86400_000;
/** Net sales over the last 30 days for one machine, in sats. */
export const trailingNet = (st: State, machine: string, now: number) => netOf(st.sales.filter((s) => s.machine === machine && now - Date.parse(s.at) <= 30 * DAY).reduce((a, s) => a + s.sats, 0));

/** Every part that has come due for every scout, with what became of it. Derived from the state, so it cannot drift. */
export function scoutRewards(st: State, now = Date.now(), spu?: number): ScoutReward[] {
  const out: ScoutReward[] = [];
  const yes = STAGES.indexOf("Yes");
  for (const c of st.claims) {
    if (c.kind !== "scout" || !c.job.startsWith("scout:")) continue;
    const prospect = c.job.slice(6);
    if (out.some((r) => r.prospect === prospect)) continue; // the first claim is the scout of record
    const onCrew = st.applicants.some((a) => a.id === c.by && a.stage === "On the crew");
    const placedM = st.machines.find((m) => m.prospectId === prospect && m.status === "Placed");
    const stage = st.tracked[prospect];
    const due: ScoutPart[] = [];
    if (stage && STAGES.indexOf(stage) >= yes) due.push("deal");
    if (stage === "Placed" || placedM) due.push("placed");
    if (placedM?.placedAt && now - Date.parse(placedM.placedAt) >= 60 * DAY && satsToUsd(trailingNet(st, placedM.id, now), spu) >= RATES.scoutDay60MinNetUsd) due.push("day60");
    for (const part of due) {
      const key = `${prospect}:${part}`;
      const paid = st.scoutPaid?.[key];
      const state = paid ? "paid" : st.scoutForfeit?.[key] || !onCrew ? "forfeited" : "due";
      out.push({ key, prospect, scout: c.by, part, usd: PART_USD[part], state, sats: paid?.sats });
    }
  }
  return out;
}

/** Writes down every forfeit that has happened, so it stays forfeited. Call before saving the state. Returns true when something changed. */
export function settleScout(st: State, h?: number, now = Date.now()): boolean {
  let changed = false;
  for (const r of scoutRewards(st, now)) {
    if (r.state === "forfeited" && !st.scoutForfeit?.[r.key]) { (st.scoutForfeit ??= {})[r.key] = { at: new Date(now).toISOString(), h }; changed = true; }
  }
  return changed;
}

/** The three scout parts in sats at one price. For the crew page and the feed (sats only). */
export const scoutPartSats = (spu: number) => ({ deal: usdToSats(PART_USD.deal, spu), placed: usdToSats(PART_USD.placed, spu), day60: usdToSats(PART_USD.day60, spu) });
