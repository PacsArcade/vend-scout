import { GIG, zoneKey } from "./gig";
import { distM } from "./score";
import type { Job } from "./jobs";
import type { State } from "./store";

export interface Offer { id: string; kind: Job["kind"]; title: string; detail: string; base: number; bonus: number; total: number; km: number | null; tag: "block" | "welcome" | null; lat?: number; lon?: number }
type Pt = { lat: number; lon: number } | null;

export const doneCount = (st: State, crew: string) => st.claims.filter((c) => c.by === crew && c.doneAt).length;
export const isNewcomer = (st: State, crew: string) => doneCount(st, crew) < GIG.welcomeJobs;

const pinOf = (st: State, id: string): Pt => { const a = st.applicants.find((x) => x.id === id); return a?.lat !== undefined ? { lat: a.lat, lon: a.lon! } : null; };
const km = (a: Pt, b: { lat?: number; lon?: number }) => (a && b.lat !== undefined ? distM([a.lat, a.lon], [b.lat, b.lon!]) / 1000 : null);

/** Who gets first look at a job: scheduled blocks covering the job's area right now, then new workers near it. */
export function priorityFor(st: State, job: Job, now: number, centers: Record<string, [number, number]>): Map<string, "block" | "welcome"> {
  const out = new Map<string, "block" | "welcome">();
  if (job.lat === undefined) return out;
  for (const b of st.blocks) {
    if (Date.parse(b.startAt) <= now && now <= Date.parse(b.endAt) && centers[b.city]) {
      const c = centers[b.city];
      if (distM([c[0], c[1]], [job.lat, job.lon!]) / 1000 <= GIG.blockKm) out.set(b.by, "block");
    }
  }
  for (const a of st.applicants) {
    if (a.stage !== "On the crew" || !st.online[a.id] || out.has(a.id) || !isNewcomer(st, a.id)) continue;
    const d = km(pinOf(st, a.id), job);
    if (d !== null && d <= GIG.welcomeKm) out.set(a.id, "welcome");
  }
  return out;
}

/** Offers for one worker. A job reserved for others stays hidden from this worker until the first look ends. */
export function offersFor(st: State, jobs: Job[], crew: string, loc: Pt, now: number, centers: Record<string, [number, number]>): Offer[] {
  const from = loc ?? pinOf(st, crew);
  const passed = new Set(st.passes[crew] ?? []);
  const out: Offer[] = [];
  for (const j of jobs) {
    if (passed.has(j.id)) continue;
    const pri = priorityFor(st, j, now, centers);
    const inWindow = now - (st.seen[j.id] ?? now) < GIG.firstLookMs;
    if (pri.size > 0 && !pri.has(crew) && inWindow) continue;
    out.push({ id: j.id, kind: j.kind, title: j.title, detail: j.detail, base: j.sats, bonus: j.bonus, total: j.sats + j.bonus, km: km(from, j), tag: pri.get(crew) ?? null, lat: j.lat, lon: j.lon });
  }
  return out.sort((a, b) => (a.tag ? 0 : 1) - (b.tag ? 0 : 1) || (a.km ?? 1e9) - (b.km ?? 1e9));
}

export function zonesOf(jobs: Job[]): { lat: number; lon: number; count: number }[] {
  const z = new Map<string, { lat: number; lon: number; count: number }>();
  for (const j of jobs) {
    if (j.lat === undefined) continue;
    const k = zoneKey(j.lat, j.lon!);
    const cur = z.get(k) ?? { lat: (Math.floor(j.lat / GIG.cellDeg) + 0.5) * GIG.cellDeg, lon: (Math.floor(j.lon! / GIG.cellDeg) + 0.5) * GIG.cellDeg, count: 0 };
    cur.count++; z.set(k, cur);
  }
  return [...z.values()];
}
