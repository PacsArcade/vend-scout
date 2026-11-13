import type { Applicant, Claim, ItemRequest, Listing, Machine, MachineReport, NeighborVerify, PickupOrder, Proof, Route, Sale } from "./types";

// A machine passport: the real history of one machine, built only from records the store already keeps.
// Nothing is tracked for it. Pure: give it the state slices, get a timeline, oldest first.
export type PassportKind = "added" | "placed" | "restock" | "proof" | "stop" | "sale" | "shelf" | "order" | "verify" | "report" | "request";
export interface PassportEvent { at: string; h?: number; kind: PassportKind; text: string; who?: string; sats?: number }
export interface PassportSlice { machines: Machine[]; proofs: Proof[]; routes: Route[]; claims: Claim[]; sales: Sale[]; orders: PickupOrder[]; listings: Listing[]; verifies: NeighborVerify[]; reports: MachineReport[]; itemRequests: ItemRequest[]; applicants: Applicant[] }
export interface Passport { events: PassportEvent[]; counts: { service: number; sales: number; salesSats: number; reports: number; verifies: number } }

/** Money, who did the work and neighbor text are left out of the public view. */
export const PUBLIC_KINDS: PassportKind[] = ["added", "placed", "restock", "proof", "stop", "shelf", "verify"];

export function passportFor(st: PassportSlice, id: string, opts: { publicView?: boolean } = {}): Passport {
  const m = st.machines.find((x) => x.id === id);
  const ev: PassportEvent[] = [];
  if (!m) return { events: ev, counts: { service: 0, sales: 0, salesSats: 0, reports: 0, verifies: 0 } };
  const nameOf = (apId: string) => { const a = st.applicants.find((x) => x.id === apId); return a ? a.crewName || a.name : ""; };
  if (m.addedAt) ev.push({ at: m.addedAt, kind: "added", text: "Added to the fleet" });
  if (m.placedAt && m.status !== "In storage") ev.push({ at: m.placedAt, h: m.h, kind: "placed", text: m.hostName ? `Placed at ${m.hostName}` : "Placed" });
  for (const p of st.proofs.filter((x) => x.machine === id)) {
    const done = p.history.find((e) => e.status === "approved");
    ev.push({ at: p.sentAt, kind: "proof", who: nameOf(p.by), text: `Photo proof sent (${p.jobKind})` });
    for (const e of p.history) if (e.status === "retake") ev.push({ at: e.at, h: e.h, kind: "proof", text: "Retake asked for the photos" });
    if (done) ev.push({ at: done.at, h: done.h, kind: "restock", who: nameOf(p.by), text: `${p.jobKind === "restock" ? "Restock" : "Job"} checked and approved` });
  }
  for (const r of st.routes) for (const d of r.done.filter((x) => x.machine === id)) ev.push({ at: d.at, h: d.h, kind: "stop", who: r.runner ? nameOf(r.runner) : "", text: `Route stop done (${r.name})` });
  for (const c of st.claims.filter((x) => x.doneAt && (x.job === `restock:${id}` || x.job === `tech:${id}`))) ev.push({ at: c.doneAt!, h: c.doneH, kind: "restock", who: nameOf(c.by), text: `${c.kind === "tech" ? "Tech job" : "Restock job"} done` });
  for (const l of st.listings.filter((x) => x.machine === id && x.status === "approved")) ev.push({ at: l.createdAt, h: l.h, kind: "shelf", text: `Local shelf item listed: ${l.item}` });
  for (const v of st.verifies.filter((x) => x.machine === id)) ev.push({ at: v.at, h: v.h, kind: "verify", text: "A neighbor checked the photos" });
  for (const s of st.sales.filter((x) => x.machine === id)) ev.push({ at: s.at, h: s.h, kind: "sale", sats: s.sats, text: `Sold ${s.item}${s.test ? " (test)" : ""}` });
  for (const o of st.orders.filter((x) => x.machine === id)) ev.push({ at: o.createdAt, h: o.h, kind: "order", text: `Pickup order held: ${o.item}` });
  for (const r of st.reports.filter((x) => x.machine === id)) ev.push({ at: r.at, h: r.h, kind: "report", text: `Problem reported: ${r.reason}` });
  for (const r of st.itemRequests.filter((x) => x.machine === id)) ev.push({ at: r.at, h: r.h, kind: "request", text: `Item requested: ${r.text}` });
  // Date-only stamps (added, placed) sort by their day. Same day: the date-only one first.
  ev.sort((a, b) => a.at.localeCompare(b.at));
  const out = opts.publicView ? ev.filter((e) => PUBLIC_KINDS.includes(e.kind)).map(({ who, sats, ...rest }) => (void who, void sats, rest)) : ev;
  const sales = ev.filter((e) => e.kind === "sale");
  return { events: out, counts: { service: ev.filter((e) => e.kind === "restock" || e.kind === "stop").length, sales: sales.length, salesSats: sales.reduce((a, e) => a + (e.sats ?? 0), 0), reports: ev.filter((e) => e.kind === "report").length, verifies: ev.filter((e) => e.kind === "verify").length } };
}
