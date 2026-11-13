import { verifyEvent } from "nostr-tools";
import { heightFor } from "./bft";
import { npubToHex, operatorHexKeys } from "./operator";
import { RENT_APPROVAL_KIND, approvalContent } from "./rentevent";
export { RENT_APPROVAL_KIND, approvalContent, approvalUnsigned } from "./rentevent";
import type { HostApp, Machine, RentApproval, RentTerms, Sale } from "./types";
import { DEFAULT_PERIOD_BLOCKS } from "./types";

// Rent in sats for the owner (host) of a machine. Pure: give it the state slices and the block height, get the owed lines.
// Periods are counted in blocks from the height the terms were set (never calendar months).
// MONEY LAW: nothing here sends money. A line can only be marked "approved, not sent" by a signed operator event (see verifyRentApproval).
export const NOT_SENT = "approved, not sent (no payment rail yet)";
const MAX_PERIODS = 120;

export interface RentSlice { machines: Machine[]; sales: Sale[]; hostApps?: HostApp[]; rentApprovals?: Record<string, RentApproval> }
export type LineState = "accruing" | "needs address" | "ready" | "approved";
export interface OwedLine {
  id: string; machine: string; machineName: string; owner: string; // owner = npub
  period: number; fromH: number; toH: number; // blocks fromH up to (not including) toH
  salesCount: number; salesSats: number; percentSats: number; flatSats: number; sats: number;
  address: string; // "" when none on file
  state: LineState; staleApproval: boolean;
}

/** Clean terms from operator input. Percent 0 to 100, flat 0 and up, period 144 blocks (a day) and up. */
export function cleanRent(input: { flatSats?: unknown; percent?: unknown; periodBlocks?: unknown }, startH: number): RentTerms | { error: string } {
  const flat = Math.round(Number(input.flatSats) || 0), pct = Number(input.percent) || 0;
  const period = Math.round(Number(input.periodBlocks) || DEFAULT_PERIOD_BLOCKS);
  if (flat < 0 || flat > 100_000_000) return { error: "The flat amount must be 0 or more sats" };
  if (pct < 0 || pct > 100) return { error: "The percent must be 0 to 100" };
  if (period < 144 || period > 52416) return { error: "A period is 144 to 52,416 blocks" };
  if (flat === 0 && pct === 0) return { error: "Set a flat amount, a percent, or both" };
  return { flatSats: flat, percent: Math.round(pct * 100) / 100, periodBlocks: period, startH };
}

/** The Lightning address on file for an owner: the approved application linked to this machine, else any approved one from the same key. */
export function payeeFor(apps: HostApp[] | undefined, ownerHex: string, machine: string): string {
  const mine = (apps ?? []).filter((a) => a.stage === "Approved" && npubToHex(a.npub) === ownerHex);
  return (mine.find((a) => a.machine === machine) ?? mine[0])?.payout ?? "";
}

export function owedLines(st: RentSlice, nowH: number): OwedLine[] {
  const out: OwedLine[] = [];
  for (const m of st.machines) {
    const t = m.rent, ownerHex = m.ownerNpub ? npubToHex(m.ownerNpub) : null;
    if (!t || !ownerHex || !m.ownerNpub || !(t.periodBlocks > 0)) continue;
    const sales = st.sales.filter((s) => s.machine === m.id && !s.test).map((s) => ({ s, h: heightFor(s.at, s.h, nowH) })).filter((x) => x.h >= t.startH);
    const last = Math.min(Math.max(0, Math.floor((nowH - t.startH) / t.periodBlocks)), MAX_PERIODS);
    const address = payeeFor(st.hostApps, ownerHex, m.id);
    for (let k = 0; k <= last; k++) {
      const fromH = t.startH + k * t.periodBlocks, toH = fromH + t.periodBlocks;
      const inP = sales.filter((x) => x.h >= fromH && x.h < toH);
      const salesSats = inP.reduce((a, x) => a + x.s.sats, 0);
      const closed = toH <= nowH;
      const percentSats = Math.floor((salesSats * t.percent) / 100);
      const flatSats = closed ? t.flatSats : 0; // the flat part is owed once the period is over
      const sats = closed ? flatSats + percentSats : 0;
      if (closed && sats === 0) continue;
      if (!closed && salesSats === 0 && k !== last) continue;
      const id = `${m.id}:${ownerHex.slice(0, 8)}:${k}`;
      const ap = st.rentApprovals?.[id];
      const approved = !!ap && ap.sats === sats && ap.address === address;
      out.push({ id, machine: m.id, machineName: m.name, owner: m.ownerNpub, period: k, fromH, toH, salesCount: inP.length, salesSats, percentSats, flatSats, sats, address, staleApproval: !!ap && !approved,
        state: !closed ? "accruing" : approved ? "approved" : !address ? "needs address" : "ready" });
    }
  }
  return out;
}

/** An owner sees only their own lines. */
export const linesForOwner = (lines: OwedLine[], ownerHex: string | null): OwedLine[] => (ownerHex ? lines.filter((l) => npubToHex(l.owner) === ownerHex) : []);

/** The Lightning payout cap per line, in sats. VEND_RENT_CAP_SATS overrides. */
export const rentCap = () => { const n = Math.round(Number(process.env.VEND_RENT_CAP_SATS)); return n > 0 ? n : 200_000; };


type Ev = { id?: string; pubkey?: string; sig?: string; kind?: number; created_at?: number; tags?: string[][]; content?: string };
/** Check a signed approval against the line as the server computes it now. Bad signature, a key that is not an operator, a changed amount or address, a stale event, a line not ready, or an amount over the cap all fail. */
export function verifyRentApproval(ev: Ev, line: OwedLine | undefined, opts: { operators?: string[]; cap?: number; now?: number } = {}): { ok: true; pubkey: string } | { ok: false; reason: string } {
  const ops = opts.operators ?? operatorHexKeys(), cap = opts.cap ?? rentCap(), now = opts.now ?? Date.now();
  if (!ev || ev.kind !== RENT_APPROVAL_KIND || !ev.pubkey || !ev.sig || typeof ev.content !== "string") return { ok: false, reason: "A signed approval is needed" };
  try { if (!verifyEvent(ev as never)) return { ok: false, reason: "The signature check failed" }; } catch { return { ok: false, reason: "The signature check failed" }; }
  if (!ops.includes(ev.pubkey)) return { ok: false, reason: "That key is not on this site's operator list" };
  if (Math.abs(now / 1000 - (ev.created_at ?? 0)) > 600) return { ok: false, reason: "That approval is too old. Sign it again" };
  if (!line) return { ok: false, reason: "No such owed line" };
  if (line.state === "accruing") return { ok: false, reason: "That period is not over yet" };
  if (line.state === "needs address") return { ok: false, reason: "The owner has no Lightning address on file" };
  if (ev.content !== approvalContent(line)) return { ok: false, reason: "The amount, address or line changed since you signed. Reload and sign again" };
  if (line.sats > cap) return { ok: false, reason: `That is over the ${cap.toLocaleString("en-US")} sat cap for one line. Raise the cap on the server first` };
  return { ok: true, pubkey: ev.pubkey };
}
