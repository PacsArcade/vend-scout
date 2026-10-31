"use client";
import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";

// The block loader. Our own arcade design: single square blocks (no game pieces) fall into one column per kind and stack,
// gently looping. When a kind lands its column fills to a height for its count and flashes, and the number counts up.
// CSS does the falling. Reduced motion: static columns plus the text.
export const COLS: { c: Category; short: string; full: string }[] = [
  { c: "laundry", short: "Suds", full: "Laundromats" }, { c: "gym", short: "Gyms", full: "Gyms" }, { c: "car_wash", short: "Cars", full: "Car washes" },
  { c: "car_repair", short: "Repair", full: "Auto shops" }, { c: "vending", short: "Vend", full: "Vending machines" }, { c: "convenience", short: "Shops", full: "Convenience shops" }, { c: "fast_food", short: "Food", full: "Fast food" },
];
const SLOTS = 6;

/** A number that counts up to its value. With reduced motion it just shows the value. */
export function Ticker({ value, ms = 800 }: { value: number; ms?: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { from.current = value; setTimeout(() => setV(value), 0); return; }
    const start = Date.now(), a = from.current;
    const id = setInterval(() => {
      const k = Math.max(0, Math.min(1, (Date.now() - start) / ms));
      setV(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) { from.current = value; clearInterval(id); }
    }, 40);
    return () => clearInterval(id);
  }, [value, ms]);
  return <span className="num">{v.toLocaleString("en-US")}</span>;
}

export function BlockLoader({ landed, elapsed, note }: { landed: Partial<Record<Category, number>>; elapsed: number; note: string }) {
  const max = Math.max(1, ...Object.values(landed).map((n) => n ?? 0));
  const total = Object.values(landed).reduce((a, n) => a + (n ?? 0), 0);
  return (
    <div className="blockloader" role="status" aria-live="polite" aria-label={`Scanning. ${elapsed} seconds so far.`}>
      <div className="bl-cols">
        {COLS.map(({ c, short, full }, ci) => {
          const n = landed[c];
          const done = n !== undefined;
          const fill = done && n > 0 ? Math.min(SLOTS, Math.ceil((n / max) * SLOTS)) : 0; // whole rows only, the same rule for every column
          return (
            <div key={c} className={"bl-col" + (done ? " landed" : "")} title={full}>
              <div className="bl-well" aria-hidden="true">
                {Array.from({ length: SLOTS }, (_, i) => (
                  <i key={i} className={"bl-block" + (done ? (i < fill ? " on" : " off") : "")} style={{ gridRow: SLOTS - i, ...(done ? {} : { animationDelay: `${(ci * 0.6 + i * 0.9) % 5.4}s` }) }} />
                ))}
              </div>
              <div className="bl-num num">{done ? <Ticker value={n} /> : "..."}</div>
              <div className="bl-lab">{short}</div>
            </div>
          );
        })}
      </div>
      <p className="bl-text"><span className="num">{elapsed}</span> s{note ? `, ${note}` : ", asking OpenStreetMap"}</p>
      {total > 0 && <p className="foundcount num"><Ticker value={total} /> places found so far</p>}
    </div>
  );
}
