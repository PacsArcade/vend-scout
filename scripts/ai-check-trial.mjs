// Runs the photo checker on the seeded proofs and prints verdicts and timings.
// Needs the app running (BASE, default http://localhost:4310) on the seeded state, started with OLLAMA_URL=http://127.0.0.1:11434.
// The checker only SUGGESTS. This script approves nothing and pays nothing.
const BASE = process.env.BASE || "http://localhost:4310";
const ids = (process.env.PROOFS || "p300,p301").split(",");
for (const id of ids) {
  const t = Date.now();
  const r = await fetch(`${BASE}/api/ai-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proof: id }), signal: AbortSignal.timeout(150_000) }).then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
  const v = r.verdict;
  console.log(`proof ${id}: ${v ? v.overall : "no verdict"}  (${((Date.now() - t) / 1000).toFixed(1)} s round trip)`);
  if (v) {
    console.log(`  model ${v.model}, checker time ${(v.ms / 1000).toFixed(1)} s, glass clean: ${v.glassClean}, load matches: ${v.loadMatches}${v.error ? `, error: ${v.error}` : ""}`);
    for (const s of v.slots) console.log(`  slot ${s.slot} ${s.expected_item}: stocked ${s.looks_stocked}, right item ${s.matches_item}`);
    for (const x of v.reasons) console.log(`  reason: ${x}`);
  } else console.log(`  ${r.error ?? ""}`);
}
