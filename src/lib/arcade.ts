// The arcade score layer. Original design for Vend Scout. See ARCADE in gig.ts.
// RULE: no points for driving speed or time between stops. Nothing in this file reads a duration.
import { ARCADE, LEVELS } from "./gig";
import type { Proof } from "./types";

export interface Breakdown { label: string; points: number }
export interface StopFacts {
  loadTotal: number; ticked: number; checkerSaysLoadMatches: boolean; checkerSaysGlassClean: boolean;
  soldOutAtVisit: boolean; localDelivered: boolean; inBlock: boolean; streakDays: number;
}

export function scoreStop(f: StopFacts): { points: number; breakdown: Breakdown[] } {
  const b: Breakdown[] = [{ label: "Stop done", points: ARCADE.stop }];
  if (f.loadTotal > 0 && f.ticked >= f.loadTotal && f.checkerSaysLoadMatches) b.push({ label: "Full fill", points: ARCADE.fullFill });
  if (f.checkerSaysGlassClean) b.push({ label: "Clean glass", points: ARCADE.cleanGlass });
  if (!f.soldOutAtVisit) b.push({ label: "Stocked before sell-out", points: ARCADE.beforeSellOut });
  if (f.localDelivered) b.push({ label: "Local shelf delivered", points: ARCADE.localDelivered });
  if (f.inBlock) b.push({ label: "On time in your block", points: ARCADE.inBlock });
  if (f.streakDays > 1) b.push({ label: `${f.streakDays} days in a row`, points: ARCADE.streakStep * Math.min(f.streakDays - 1, ARCADE.streakMaxDays) });
  return { points: b.reduce((a, x) => a + x.points, 0), breakdown: b };
}

/** Combo: a whole route approved with no retakes. Extra points on top of the route's stop points. */
export function comboBonus(routeStopPoints: number): number {
  return Math.floor(routeStopPoints * (ARCADE.comboMultiplier - 1));
}

/** Days in a row, ending today, with at least one approved stop. dates are YYYY-MM-DD. */
export function streakDays(approvedDates: string[], today: string): number {
  const set = new Set(approvedDates);
  let n = 0;
  const d = new Date(today + "T00:00:00Z");
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

export function levelOf(points: number) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (points >= LEVELS[k].at) i = k;
  const next = LEVELS[i + 1];
  return { level: i + 1, name: LEVELS[i].name, next: next ? next.at : null, nextName: next?.name ?? null, pctToNext: next ? Math.round(((points - LEVELS[i].at) / (next.at - LEVELS[i].at)) * 100) : 100 };
}

export const totalPoints = (proofs: Proof[], by: string) => proofs.filter((p) => p.by === by && p.status === "approved").reduce((a, p) => a + (p.points ?? 0), 0);

export interface Badge { id: string; name: string; note: string; got: boolean }
export function badgesFor(proofs: Proof[], by: string): Badge[] {
  const mine = proofs.filter((p) => p.by === by && p.status === "approved");
  const has = (label: string) => mine.some((p) => p.breakdown?.some((b) => b.label === label));
  return [
    { id: "first", name: "First stop", note: "One approved stop", got: mine.length >= 1 },
    { id: "ten", name: "Ten stops", note: "Ten approved stops", got: mine.length >= 10 },
    { id: "fill", name: "Full fill", note: "Every slot on the list stocked", got: has("Full fill") },
    { id: "local", name: "Local hero", note: "A local shelf item delivered", got: has("Local shelf delivered") },
    { id: "streak", name: "Three days running", note: "Three days in a row with an approved stop", got: mine.some((p) => p.breakdown?.some((b) => /days in a row/.test(b.label) && Number.parseInt(b.label, 10) >= 3)) },
    { id: "combo", name: "Clean route", note: "A whole route approved with no retakes", got: has("Clean route combo") },
  ];
}

/** First name and last initial only. A single name stays single. */
export function boardName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length < 2 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Points for a scout's "Already inside" check. A photo is the base. Naming who runs it, the machine state and the room answer add more. Never for speed. */
export function scoutAward(c: { photo?: string; who: string; state?: string; room: string }): { points: number; breakdown: Breakdown[] } {
  const b: Breakdown[] = [];
  if (c.photo) b.push({ label: "Check with photo", points: ARCADE.scoutPhoto });
  if (c.who.trim()) b.push({ label: "Named who runs it", points: ARCADE.scoutWho });
  if (c.state) b.push({ label: "Machine state", points: ARCADE.scoutState });
  if (c.room === "yes" || c.room === "no") b.push({ label: "Room for another", points: ARCADE.scoutRoom });
  return { points: b.reduce((a, x) => a + x.points, 0), breakdown: b };
}
export const scoutPoints = (awards: { by: string; points: number }[], by: string) => awards.filter((x) => x.by === by).reduce((a, x) => a + x.points, 0);
