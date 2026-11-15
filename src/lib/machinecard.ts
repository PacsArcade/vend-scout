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

/** Join words with "and": "a", "a and b", "a, b and c". */
export const andList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** r26: what a screen reader hears for the machine card's money marks: "Takes bitcoin and cash". Null when nothing is recorded. */
export function takesSaid(ways: PayWay[]): string | null {
  return ways.length ? `Takes ${andList(ways)}` : null;
}
/** r26: the colours of the money marks on the machine card, and the card behind them. Each pair is measured in machinecard.test.ts (4.5:1 or more). */
export const MARK_INK = { bitcoin: "#f7931a", cash: "#90ca90", cards: "#ffffff" } as const;
export const CARD_FACT_BG = "#262626";
/** WCAG 2 contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
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
