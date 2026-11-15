import type { MachineProfile } from "./types";

// r23: the facts the map's machine card shows. Plain words, built from what an operator entered on the machine.

export type PayWay = "bitcoin" | "cards" | "cash";
/** The ways to pay a machine's profile records, in a fixed order. Never more than the profile says. */
export function payWays(p: Pick<MachineProfile, "lightning" | "cardReader" | "cash">): PayWay[] {
  return [p.lightning && "bitcoin", p.cardReader.trim() && "cards", p.cash && "cash"].filter(Boolean) as PayWay[];
}
/** Join words the house way: "a", "a or b", "a, b or c". */
export const orList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
/** r24: what a machine takes, said once: "Takes bitcoin or cash", "Takes bitcoin", "Takes cash". Null when nothing is recorded. */
export function takesLine(p: Pick<MachineProfile, "lightning" | "cardReader" | "cash">): string | null {
  const w = payWays(p);
  return w.length ? `Takes ${orList(w)}` : null;
}

/** How long ago, in words: "Today", "Yesterday", "3 days ago", "5 weeks ago". */
export function agoLine(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Not known";
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 21) return `${days} days ago`;
  if (days < 120) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}
