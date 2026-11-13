import { stampParts } from "@/lib/bft";

/**
 * THE stamp. Every block-and-time line in the app is drawn here, in the house order: block first, then date, then time.
 * Each part is its own span (st-block, st-date, st-time) so a header can hide the block first, then the date, and keep the time.
 * Pure markup, no hooks, so server and client components both use it. Give a height, or the three parts (the live clock does).
 */
export function Stamp({ h, parts, className = "" }: { h?: number; parts?: { block: string; date: string; time: string }; className?: string }) {
  const p = parts ?? (h !== undefined ? stampParts(h) : null);
  if (!p) return null;
  return (
    <span className={`stamp mono ${className}`.trim()} data-stamp>
      <span className="st st-block">{p.block}<span aria-hidden="true">{"\u00a0· "}</span></span>
      <span className="st st-date">{p.date}<span aria-hidden="true">{" "}</span></span>
      <span className="st st-time">{p.time}</span>
    </span>
  );
}
