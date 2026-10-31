// Bitcoin Federated Time. Logic copied from frens.earth src/lib/bb/bft.ts (not imported across repos).
// 13 months x 28 days x 144 blocks a day. Genesis is a₿ 0. Display: "yyyy.mm.dd hh:mm a₿", marker after.
export const BLOCKS_PER_DAY = 144;
export const BLOCKS_PER_MONTH = 4032;
export const BLOCKS_PER_YEAR = 52416;
const pad = (n: number, w: number) => String(n).padStart(w, "0");

export function bftDatePlain(height: number): string {
  const rem = ((height % BLOCKS_PER_YEAR) + BLOCKS_PER_YEAR) % BLOCKS_PER_YEAR;
  const year = Math.floor(height / BLOCKS_PER_YEAR);
  const month = Math.floor(rem / BLOCKS_PER_MONTH) + 1;
  const day = Math.floor((rem % BLOCKS_PER_MONTH) / BLOCKS_PER_DAY) + 1;
  return `${pad(year, 4)}.${pad(month, 2)}.${pad(day, 2)}`;
}
export function bftTime(height: number): string {
  const bid = ((height % BLOCKS_PER_DAY) + BLOCKS_PER_DAY) % BLOCKS_PER_DAY;
  return `${pad(Math.floor(bid / 6), 2)}:${pad((bid % 6) * 10, 2)}`;
}
export const bftDateTime = (h: number) => `${bftDatePlain(h)} ${bftTime(h)}`;
/** What the UI shows: BFT date and time, marker after, plus the block height. */
export const stampText = (h: number) => `${bftDateTime(h)} a₿ · block ${h.toLocaleString("en-US")}`;
/** Height for a stored record: the height saved with it, else estimated from its ISO time against the current height. */
export function heightFor(iso: string | undefined, h: number | undefined, nowHeight: number): number {
  if (typeof h === "number") return h;
  const t = iso ? Date.parse(iso.length === 10 ? iso + "T12:00:00Z" : iso) : NaN;
  if (Number.isNaN(t)) return nowHeight;
  return nowHeight - Math.round((Date.now() - t) / 600000);
}
