import type { Proof } from "./types";
import type { State } from "./store";

/** The stocking photo a neighbor sees: the newest proof for a machine that is waiting or approved. A retake request is not shown. */
export function latestProof(st: Pick<State, "proofs">, machine: string): Proof | null {
  return st.proofs.filter((p) => p.machine === machine && (p.status === "sent" || p.status === "approved")).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] ?? null;
}
/** The tag people post with: #frensvend and #FV-<machine id>. */
export const machineTag = (id: string) => `FV-${id.toUpperCase()}`;
export const SHARE_TAGS = (id: string) => `#frensvend #${machineTag(id)}`;
export const REPORT_REASONS = ["The machine is empty", "The machine is broken", "The photo is old or wrong", "It looks dirty or unsafe", "Something else"];

/** Check a signed kind 1 note before giving share credits: signed by this key, carries both tags, and is fresh. */
export function shareNoteOk(ev: { kind?: number; pubkey?: string; content?: string; created_at?: number }, npubHex: string, machine: string, now = Date.now()): string | null {
  if (ev.kind !== 1) return "That is not a note";
  if (ev.pubkey !== npubHex) return "That note was not signed by you";
  const c = ev.content ?? "";
  if (!c.includes("#frensvend") || !c.toUpperCase().includes(`#${machineTag(machine)}`)) return "The note needs both tags";
  if (Math.abs(now / 1000 - (ev.created_at ?? 0)) > 600) return "That note is too old";
  return null;
}
