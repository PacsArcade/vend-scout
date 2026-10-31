import { findProspect } from "./overpass";
import { JOB_NOUN, satsFor } from "./crew";
import { rateFeed } from "./rate";
import type { State } from "./store";
import { GIG, zoneKey } from "./gig";
import type { JobKind } from "./types";

export interface Job { id: string; kind: JobKind; title: string; detail: string; sats: number; bonus: number; lat?: number; lon?: number }
export interface Bundle { route: string; name: string; stops: number; sats: number; lat?: number; lon?: number }

/** Open jobs, worked out from what the app already knows. Nothing here is stored except a claim. */
export async function openJobs(st: State): Promise<{ jobs: Job[]; bundles: Bundle[]; rate: string }> {
  const rate = await rateFeed.rate();
  const pay = (k: JobKind) => satsFor(k, rate.satsPerUsd);
  const claimed = new Set(st.claims.map((c) => c.job));
  const inRoute = new Set(st.routes.flatMap((r) => r.stops));
  const jobs: Job[] = [];
  for (const m of st.machines) {
    if (m.status === "Placed" && !inRoute.has(m.id)) {
      const low = m.slots.filter((s) => s.kind !== "pickup" && s.level < 0.45).length;
      if (low > 0) jobs.push({ id: `restock:${m.id}`, kind: "restock", title: `Restock ${m.name}`, detail: `${low} slot${low === 1 ? "" : "s"} low at ${m.hostName}`, sats: pay("restock"), bonus: 0, lat: m.lat, lon: m.lon });
    }
    if (m.status === "In repair") jobs.push({ id: `tech:${m.id}`, kind: "tech", title: `Repair ${m.name}`, detail: "Marked In repair. Check it and report.", sats: pay("tech"), bonus: 0 });
  }
  for (const l of st.listings) {
    if (l.status !== "approved" || l.qty < 1) continue;
    const m = st.machines.find((x) => x.id === l.machine);
    jobs.push({ id: `shelf:${l.id}`, kind: "shelf", title: `Shelf pickup: ${l.item}`, detail: `Collect from ${l.madeBy}, stock ${m?.name ?? "the machine"}. Pickup window ${l.pickupWindow}.`, sats: pay("shelf"), bonus: 0, lat: m?.lat, lon: m?.lon });
  }
  for (const [id, stage] of Object.entries(st.tracked)) {
    if (stage !== "Found" && stage !== "Visited") continue;
    const h = await findProspect(id);
    if (h) jobs.push({ id: `scout:${id}`, kind: "scout", title: `${stage === "Found" ? "Visit and pitch" : "Pitch"} ${h.prospect.name}`, detail: `Take the one-page sheet. ${h.prospect.area}.`, sats: pay("scout"), bonus: 0, lat: h.prospect.lat, lon: h.prospect.lon });
  }
  const bundles: Bundle[] = [];
  for (const r of st.routes) {
    if (r.runner) continue;
    const first = st.machines.find((m) => m.id === r.stops[0]);
    bundles.push({ route: r.id, name: r.name, stops: r.stops.length, sats: pay("restock") * r.stops.length, lat: first?.lat, lon: first?.lon });
  }
  const open = jobs.filter((j) => !claimed.has(j.id));
  // Busy bonus: a zone with many open jobs pays extra on each of them (test values in gig.ts).
  const zones = new Map<string, number>();
  for (const j of open) if (j.lat !== undefined) zones.set(zoneKey(j.lat, j.lon!), (zones.get(zoneKey(j.lat, j.lon!)) ?? 0) + 1);
  for (const j of open) if (j.lat !== undefined && (zones.get(zoneKey(j.lat, j.lon!)) ?? 0) >= GIG.busyMinJobs) j.bonus = GIG.busyBonusSats;
  return { jobs: open, bundles, rate: rate.label };
}

/** Where a claimed job is, for the Directions link. */
export async function locate(st: State, job: string): Promise<{ lat: number; lon: number } | null> {
  const [kind, ref] = job.split(":");
  if (kind === "restock" || kind === "tech") { const m = st.machines.find((x) => x.id === ref); return m?.lat !== undefined ? { lat: m.lat, lon: m.lon! } : null; }
  if (kind === "shelf") { const l = st.listings.find((x) => x.id === ref); const m = st.machines.find((x) => x.id === l?.machine); return m?.lat !== undefined ? { lat: m.lat, lon: m.lon! } : null; }
  if (kind === "scout") { const h = await findProspect(ref); return h ? { lat: h.prospect.lat, lon: h.prospect.lon } : null; }
  return null;
}
export const kindLabel = (k: JobKind) => JOB_NOUN[k === "restock" ? "restock" : k];
