import { boardName } from "./arcade";
import { BLOCKS_PER_DAY, heightFor } from "./bft";
import { npubToHex } from "./operator";
import { SHARE_TAGS } from "./social";
import type { Applicant, Machine, MachineReport, Proof, VendProfile } from "./types";

// Draft notices about machines. Pure: real counts from the records, no invented numbers. Nothing is posted anywhere; the operator copies a draft.
export interface NoticeSlice { machines: Machine[]; proofs: Proof[]; reports: MachineReport[]; applicants: Applicant[]; profiles?: Record<string, VendProfile> }
export interface Notice { id: string; kind: "service" | "serviced"; machine: string; text: string; facts: string[] }

export const LOW_LEVEL = 0.45; // same line the jobs board uses for a low slot
export const OVERDUE_BLOCKS = 1008; // a week of blocks without an approved service
export const JUST_BLOCKS = BLOCKS_PER_DAY; // "just serviced" = approved within the last day of blocks
const NEW_BLOCKS = 1008; // "new machine" = placed within the last week of blocks

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 21st... */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** A crew name may appear in a draft only if that person turned on public showing: the leaderboard opt-in, or a saved profile with jobs shown. Otherwise null. */
export function publicCrewName(a: Applicant | undefined, profiles?: Record<string, VendProfile>): string | null {
  if (!a || a.stage !== "On the crew") return null;
  const hex = a.npub ? npubToHex(a.npub) : null;
  const shown = a.leaderboard === true || (!!hex && profiles?.[hex]?.showJobs === true);
  if (!shown) return null;
  return a.crewName ? `${a.crewName}.vend@frens` : boardName(a.name);
}

const approvedAt = (p: Proof, nowH: number) => {
  const e = p.history.find((x) => x.status === "approved");
  return p.status === "approved" ? heightFor(p.approvedAt ?? e?.at, p.approvedH ?? e?.h, nowH) : null;
};
const blocksText = (n: number) => `${n.toLocaleString("en-US")} blocks (about ${Math.round(n / BLOCKS_PER_DAY)} BFT days)`;

export function buildNotices(st: NoticeSlice, nowH: number, origin = ""): Notice[] {
  const out: Notice[] = [];
  const done = st.proofs.filter((p) => p.machine).map((p) => ({ p, h: approvedAt(p, nowH) })).filter((x): x is { p: Proof; h: number } => x.h !== null);
  const byMachine = (id: string) => done.filter((x) => x.p.machine === id).sort((a, b) => b.h - a.h);
  const link = (id: string) => (origin ? ` ${origin}/m/${id}` : "");

  // Just serviced
  for (const x of done.filter((d) => nowH - d.h >= 0 && nowH - d.h <= JUST_BLOCKS)) {
    const m = st.machines.find((y) => y.id === x.p.machine);
    if (!m || m.status !== "Placed") continue;
    const ap = st.applicants.find((a) => a.id === x.p.by);
    const day = Math.floor(x.h / BLOCKS_PER_DAY);
    const theirs = done.filter((d) => d.p.by === x.p.by).sort((a, b) => a.h - b.h || a.p.id.localeCompare(b.p.id));
    const today = theirs.filter((d) => Math.floor(d.h / BLOCKS_PER_DAY) === day);
    const nth = today.findIndex((d) => d.p.id === x.p.id) + 1;
    const fleetToday = done.filter((d) => Math.floor(d.h / BLOCKS_PER_DAY) === day).length;
    const name = publicCrewName(ap, st.profiles);
    const isNew = !!m.placedAt && nowH - heightFor(m.placedAt, m.h, nowH) <= NEW_BLOCKS;
    const what = `${isNew ? "the new machine " : ""}${m.name}${m.hostName ? ` at ${m.hostName}` : ""}`;
    const facts = [`Approved at block ${x.h.toLocaleString("en-US")}`, `${fleetToday} approved service${fleetToday === 1 ? "" : "s"} across the fleet that BFT day`];
    let text: string;
    if (name) {
      facts.push(`${name} has ${nth} approved service${nth === 1 ? "" : "s"} that BFT day, ${theirs.length} in all`);
      text = `Check out ${name}, they just serviced ${what}. That's their ${ordinal(nth)} service today${theirs.length > nth ? `, ${theirs.length} in all` : ""}. Fresh stock, photos checked.${link(m.id)} ${SHARE_TAGS(m.id)}`;
    } else {
      text = `Fresh stock just went into ${what}. Photos checked by a person. ${fleetToday === 1 ? "That is the first service across the fleet today." : `That is service number ${fleetToday} across the fleet today.`}${link(m.id)} ${SHARE_TAGS(m.id)}`;
    }
    out.push({ id: `serviced:${x.p.id}`, kind: "serviced", machine: m.id, text, facts });
  }

  // Needs service
  for (const m of st.machines.filter((y) => y.status === "Placed")) {
    const slots = m.slots.filter((s) => s.kind !== "pickup");
    const low = slots.filter((s) => s.level < LOW_LEVEL).length;
    const last = byMachine(m.id)[0]?.h ?? null;
    const reports = st.reports.filter((r) => r.machine === m.id && (last === null || heightFor(r.at, r.h, nowH) > last)).length;
    const sinceH = last ?? (m.placedAt ? heightFor(m.placedAt, m.h, nowH) : null);
    const overdue = sinceH !== null && nowH - sinceH > OVERDUE_BLOCKS;
    if (low === 0 && reports === 0 && !overdue && !m.restockRequested) continue;
    const bits: string[] = [], facts: string[] = [];
    if (low > 0) { bits.push(`${low} of ${slots.length} slots are running low`); facts.push(`${low} of ${slots.length} slots below ${Math.round(LOW_LEVEL * 100)}%`); }
    if (reports > 0) { bits.push(`${reports} neighbor report${reports === 1 ? "" : "s"} since the last service`); facts.push(`${reports} report${reports === 1 ? "" : "s"}`); }
    if (overdue && sinceH !== null) { bits.push(last !== null ? `the last approved service was ${blocksText(nowH - sinceH)} ago` : `no approved service since it was placed ${blocksText(nowH - sinceH)} ago`); facts.push("overdue"); }
    if (m.restockRequested) { bits.push("a restock was asked for"); facts.push("restock requested"); }
    out.push({ id: `service:${m.id}`, kind: "service", machine: m.id, facts, text: `Heads up: ${m.name}${m.hostName ? ` at ${m.hostName}` : ""} needs a visit. ${bits.map((b, i) => (i === 0 ? b[0].toUpperCase() + b.slice(1) : b)).join(", ")}.${link(m.id)} ${SHARE_TAGS(m.id)}` });
  }
  return out;
}
