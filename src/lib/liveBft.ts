// The live BFT face. Logic ported (copied, not imported) from frens.earth
// src/components/time/living-clock-engine.ts and its tip door (house law, ruled 969,518).
// The block height gives the date, the hour and the ten-minute step. The last minute digit and the seconds
// fill from the time since the block ARRIVED (when our side first saw that height). At 9:59 the face HOLDS
// until a new block lands. No fake pulses: an estimate is marked "~".
import { BLOCKS_PER_DAY, bftDatePlain } from "./bft";

export const BLOCK_MS = 600_000;
export const HOLD_S = 599; // the face never shows 10:00. It holds at 9:59.

export interface Arrival { height: number; at: number; est: boolean }

/** What the client does with each reading from the tip door. */
export function nextArrival(prev: Arrival | null, height: number, tipTimestampSec: number | null, now: number): Arrival {
  const fromTip = tipTimestampSec != null ? Math.min(tipTimestampSec * 1000, now) : now;
  if (prev === null) return { height, at: fromTip, est: true }; // cold load: the chain's own stamp, marked ~
  if (height > prev.height) return { height, at: now, est: false }; // a new block seen live: reset to 0:00
  if (height < prev.height) return { height, at: fromTip, est: true }; // a reorg: fall back to an estimate
  return prev;
}

/** Seconds since arrival, held at 9:59. */
export function ageSeconds(a: Arrival, now: number): number {
  return Math.min(HOLD_S, Math.max(0, Math.floor((now - a.at) / 1000)));
}

export interface Face { date: string; time: string; pct: number; est: boolean; held: boolean; height: number }
const p2 = (n: number) => String(n).padStart(2, "0");

export function face(a: Arrival, now: number): Face {
  const age = ageSeconds(a, now);
  const bid = ((a.height % BLOCKS_PER_DAY) + BLOCKS_PER_DAY) % BLOCKS_PER_DAY;
  const hh = Math.floor(bid / 6);
  const mm = (bid % 6) * 10 + Math.floor(age / 60); // ten-minute step plus the live minute digit
  const ss = age % 60;
  return { date: bftDatePlain(a.height), time: `${p2(hh)}:${p2(mm)}:${p2(ss)}`, pct: Math.round((age / 600) * 100), est: a.est, held: age >= HOLD_S, height: a.height };
}
export const faceText = (f: Face) => `${f.date} · ${f.est ? "~" : ""}${f.time} a₿ · block ${f.height.toLocaleString("en-US")}`;
