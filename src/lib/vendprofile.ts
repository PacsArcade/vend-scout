import { applicantFor } from "./crewauth";
import { countByCell, type AreaCell, type Point } from "./areas";
import { npubToHex } from "./operator";
import { nip19 } from "nostr-tools";
import type { Applicant, CrewRole, Machine, Route, Claim, Listing, VendProfile } from "./types";

// What vend.frens knows about a nostr key. Pure: give it the state slices, get a summary. No network.
export const EMPTY_VEND: VendProfile = { blurb: "", availability: "", showArea: false, showJobs: true, updatedAt: "" };
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "");

/** Clean the editable fields. Only the four known fields are kept. A field left out keeps its old value. */
export function cleanVendFields(input: Partial<VendProfile> | undefined, old: VendProfile | undefined, at: string, h?: number): VendProfile {
  const base = { ...EMPTY_VEND, ...(old ?? {}) };
  const i = input ?? {};
  return {
    blurb: "blurb" in i ? clip(i.blurb, 400) : base.blurb,
    availability: "availability" in i ? clip(i.availability, 120) : base.availability,
    showArea: "showArea" in i ? i.showArea === true : base.showArea,
    showJobs: "showJobs" in i ? i.showJobs === true : base.showJobs,
    updatedAt: at, h,
  };
}

/** A key may only edit its own record. The target comes from the request, the session key from the signed cookie. Like crewActionOk. */
export function profileActionOk(sessionHex: string | null, targetHex: string | null | undefined): { ok: true } | { ok: false; error: string } {
  if (!sessionHex) return { ok: false, error: "Sign in with nostr first." };
  if (targetHex && targetHex !== sessionHex) return { ok: false, error: "You can only edit your own profile" };
  return { ok: true };
}

/** A page address holds an npub (or a 64 character hex key). Returns both forms, or null. */
export function keyFromParam(param: string): { hex: string; npub: string } | null {
  const p = decodeURIComponent(param).trim();
  if (/^[0-9a-f]{64}$/i.test(p)) { const hex = p.toLowerCase(); return { hex, npub: nip19.npubEncode(hex) }; }
  const hex = npubToHex(p);
  return hex ? { hex, npub: p } : null;
}

export interface Slice { applicants: Applicant[]; machines: Machine[]; routes: Route[]; claims: Claim[]; listings: Listing[]; profiles?: Record<string, VendProfile> }
export interface MachineRef { id: string; name: string; status: string }
export interface VendSummary {
  onCrew: boolean; // On the crew right now
  crewName: string; // "" when none
  roles: CrewRole[];
  since: { date: string; h?: number } | null; // when they were moved to On the crew
  ownedMachines: MachineRef[];
  servicedMachines: MachineRef[];
  jobsDone: number;
  area: AreaCell[];
  vend: VendProfile;
}

const ref = (m: Machine): MachineRef => ({ id: m.id, name: m.name, status: m.status });

/** Everything we know about a key, from our own data. Empty fields stay empty. */
export function summaryFor(st: Slice, hex: string): VendSummary {
  const ap = applicantFor(st.applicants, hex);
  const onCrew = !!ap && ap.stage === "On the crew";
  const owned = st.machines.filter((m) => m.ownerNpub && npubToHex(m.ownerNpub) === hex);
  let since: VendSummary["since"] = null;
  const serviced = new Map<string, Machine>();
  const points: Point[] = [];
  let jobsDone = 0;
  if (onCrew && ap) {
    const step = [...ap.notes].reverse().find((n) => n.stage === "On the crew");
    since = step ? { date: step.date, h: step.h } : null;
    const byId = new Map(st.machines.map((m) => [m.id, m]));
    const visit = (id: string | undefined) => { const m = id ? byId.get(id) : undefined; if (m) { serviced.set(m.id, m); points.push({ lat: m.lat, lon: m.lon, kind: "job" }); } };
    for (const r of st.routes) if (r.runner === ap.id) for (const d of r.done) { jobsDone++; visit(d.machine); }
    for (const c of st.claims) if (c.by === ap.id && c.doneAt) {
      jobsDone++;
      // Job ids: restock:<machine>, tech:<machine>, shelf:<listing> (its machine), scout:<prospect> (no machine yet). A job with no machine counts as done but has no place.
      const [kind, rest] = c.job.split(":");
      visit(kind === "shelf" ? st.listings.find((l) => l.id === rest)?.machine : kind === "restock" || kind === "tech" ? rest : undefined);
    }
  }
  for (const m of owned) points.push({ lat: m.lat, lon: m.lon, kind: "machine" });
  return {
    onCrew, crewName: onCrew ? ap?.crewName ?? "" : "", roles: onCrew && ap ? ap.roles : [], since,
    ownedMachines: owned.map(ref), servicedMachines: [...serviced.values()].map(ref), jobsDone,
    area: countByCell(points), vend: { ...EMPTY_VEND, ...(st.profiles?.[hex] ?? {}) },
  };
}
