// A small in-memory limiter for the public apply form. On Vercel each instance keeps its own count,
// so this is a speed bump, not a wall. The honeypot field and the operator review are the other layers.
const hits = new Map<string, number[]>();
export function allow(key: string, max = 5, windowMs = 3600_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now); hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}
export const resetLimits = () => hits.clear();
