import type { MachineProfile } from "./types";

// r23: the facts the map's machine card shows. Plain words, built from what an operator entered on the machine.

/** What a machine takes, in words: "Bitcoin and cards", "Cash", or null when nothing is entered. */
export function takesLine(p: Pick<MachineProfile, "lightning" | "cardReader" | "cash">): string | null {
  const ways = [p.lightning && "bitcoin", p.cardReader.trim() && "cards", p.cash && "cash"].filter(Boolean) as string[];
  if (!ways.length) return null;
  const s = ways.length === 1 ? ways[0] : `${ways.slice(0, -1).join(", ")} and ${ways[ways.length - 1]}`;
  return s[0].toUpperCase() + s.slice(1);
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
