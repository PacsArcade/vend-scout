import { npubToHex } from "./operator";
import type { Applicant } from "./types";

// Who counts as crew on the live site: an applicant whose linked npub signed in AND who is On the crew.
// Everyone else is not crew, even with a valid signature. Operators bypass this (they can do everything).
export function crewFor(applicants: Applicant[], pubkeyHex: string | null): Applicant | null {
  if (!pubkeyHex) return null;
  return applicants.find((a) => a.stage === "On the crew" && a.npub && npubToHex(a.npub) === pubkeyHex) ?? null;
}
/** Applicant (any stage) linked to this key, to tell "not on the crew yet" apart from "no application". */
export const applicantFor = (applicants: Applicant[], pubkeyHex: string) => applicants.find((a) => a.npub && npubToHex(a.npub) === pubkeyHex) ?? null;

interface Body { action: string; id?: string; by?: string; job?: string; route?: string; ref?: string; runner?: string }
interface Slice { claims: { job: string; by: string }[]; routes: { id: string; runner?: string }[]; proofs: { id: string; by: string }[] }

/** A crew member may only act as themselves. Without this a signed-in runner could claim, go online or send proof for someone else. */
export function crewActionOk(st: Slice, b: Body, me: Applicant): { ok: true } | { ok: false; error: string } {
  const no = { ok: false as const, error: "You can only do that for yourself" };
  switch (b.action) {
    case "goOnline": case "onboard": case "setLeaderboard": return b.id === me.id ? { ok: true } : no;
    case "passJob": case "scheduleBlock": case "claimJob": return b.by === me.id ? { ok: true } : no;
    case "routeRunner": return b.runner === me.id ? { ok: true } : no;
    case "ackPop": return st.proofs.find((p) => p.id === b.id)?.by === me.id ? { ok: true } : no;
    case "submitProof": {
      if (b.route) return st.routes.find((r) => r.id === b.route)?.runner === me.id ? { ok: true } : no;
      return st.claims.find((c) => c.job === b.ref)?.by === me.id ? { ok: true } : no;
    }
    default: return { ok: false, error: "Operators only." };
  }
}
