import { readBin } from "./blobstore";
import type { AiSlot, AiVerdict, Proof, Tri } from "./types";

// THE PHOTO CHECKER. SHADOW MODE: it suggests, a person still approves, and nothing is paid on its word.
// AUTO_APPROVE stays false and is not reachable from the UI or any setting. Turning it on is the Admiral's ruling.
export const AUTO_APPROVE = false as const;

export const MODEL = process.env.VEND_AI_MODEL || "gemma3:12b";
/** Ollama runs on the home box only. OLLAMA_URL unset (as on Vercel) means the checker is skipped. */
export const ollamaUrl = () => (process.env.OLLAMA_URL ?? "").trim().replace(/\/+$/, "");
export const SKIP_REASON = "AI checker runs on the home box";
export const skippedVerdict = (): AiVerdict => nv(SKIP_REASON, 0);
export const TIMEOUT_MS = 90_000;

export interface CheckInput { before: string; after: string; loadItems: { slot: string; item: string; ref?: string }[] }
export interface CheckOpts { fetchImpl?: typeof fetch; timeoutMs?: number; readPhoto?: (kind: "stop" | "item", file: string) => Promise<string | null> }

const nv = (error: string, ms: number, slots: AiSlot[] = [], reasons: string[] = []): AiVerdict => ({ overall: "needs-human", glassClean: "unsure", loadMatches: "unsure", slots, reasons: reasons.length ? reasons : [error], model: MODEL, ms, at: new Date().toISOString(), error });

async function readB64(kind: "stop" | "item", file: string): Promise<string | null> {
  if (!/^[\w.-]+$/.test(file)) return null;
  return (await readBin(`${kind === "stop" ? "stops" : "items"}/${file}`))?.toString("base64") ?? null;
}
const tri = (v: unknown): Tri => (v === "yes" || v === "no" || v === "unsure" ? v : "unsure");

/** Validate the model's JSON. Anything that does not fit becomes null, and the caller says needs-human. */
export function parseVerdict(text: string, expected: { slot: string; item: string }[]): { glass: Tri; slots: AiSlot[]; reasons: string[]; overall: "pass" | "needs-human" } | null {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  if (!Array.isArray(o.slots) || !["yes", "no", "unsure"].includes(String(o.glass_clean))) return null;
  const slots: AiSlot[] = [];
  for (const e of expected) {
    const r = (o.slots as Record<string, unknown>[]).find((x) => x && String(x.slot) === e.slot);
    if (!r || !["yes", "no", "unsure"].includes(String(r.looks_stocked)) || !["yes", "no", "unsure"].includes(String(r.matches_item))) return null;
    slots.push({ slot: e.slot, expected_item: e.item, looks_stocked: tri(r.looks_stocked), matches_item: tri(r.matches_item) });
  }
  const reasons = Array.isArray(o.reasons) ? o.reasons.map((x) => String(x).slice(0, 200)).slice(0, 6) : [];
  const glass = tri(o.glass_clean);
  const all = slots.length > 0 && slots.every((s) => s.looks_stocked === "yes" && s.matches_item === "yes") && glass === "yes";
  // The model's own overall is only a hint. Anything unsure or any no means a person looks.
  const overall = all && o.overall === "pass" ? "pass" : "needs-human";
  return { glass, slots, reasons, overall };
}

export async function checkProof(input: CheckInput, opts: CheckOpts = {}): Promise<AiVerdict> {
  const t0 = Date.now();
  const f = opts.fetchImpl ?? fetch, timeout = opts.timeoutMs ?? TIMEOUT_MS, read = opts.readPhoto ?? readB64;
  try {
    if (!ollamaUrl()) return skippedVerdict();
    if (input.loadItems.length === 0) return nv("No load list to check", Date.now() - t0);
    const before = await read("stop", input.before), after = await read("stop", input.after);
    if (!before || !after) return nv("A proof photo could not be read", Date.now() - t0);
    const images = [before, after];
    const refNotes: string[] = [];
    for (const l of input.loadItems) {
      const r = l.ref ? await read("item", l.ref) : null;
      if (r) { images.push(r); refNotes.push(`Image ${images.length} is the reference photo for slot ${l.slot}: ${l.item}.`); }
    }
    const prompt = [
      "You check a vending machine restock from photos. Image 1 is the machine glass BEFORE the restock, image 2 is the glass AFTER.",
      ...refNotes,
      "Slots that should be stocked after the restock: " + input.loadItems.map((l) => `${l.slot} = ${l.item}`).join("; ") + ".",
      "Answer ONLY with JSON in this exact shape, no other text:",
      '{"slots":[{"slot":"A1","expected_item":"...","looks_stocked":"yes|no|unsure","matches_item":"yes|no|unsure"}],"glass_clean":"yes|no|unsure","overall":"pass|needs-human","reasons":["short reason"]}',
      'Include every listed slot. Use "unsure" whenever you cannot clearly see. overall is "pass" only if every slot is clearly stocked with the right item and the glass is clean.',
    ].join("\n");
    const res = await f(`${ollamaUrl()}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(timeout),
      body: JSON.stringify({ model: MODEL, stream: false, format: "json", options: { temperature: 0 }, messages: [{ role: "user", content: prompt, images }] }),
    });
    if (!res.ok) return nv(`The checker answered ${res.status}`, Date.now() - t0);
    const body = (await res.json()) as { message?: { content?: string } };
    const parsed = parseVerdict(body.message?.content ?? "", input.loadItems.map((l) => ({ slot: l.slot, item: l.item })));
    if (!parsed) return nv("The checker's answer was not in the expected form", Date.now() - t0);
    return { overall: parsed.overall, glassClean: parsed.glass, loadMatches: parsed.slots.every((s) => s.looks_stocked === "yes" && s.matches_item === "yes") ? "yes" : parsed.slots.some((s) => s.looks_stocked === "no" || s.matches_item === "no") ? "no" : "unsure", slots: parsed.slots, reasons: parsed.reasons, model: MODEL, ms: Date.now() - t0, at: new Date().toISOString() };
  } catch (e) {
    const name = (e as Error).name;
    return nv(name === "TimeoutError" || name === "AbortError" ? "The checker took too long" : "The checker is not reachable", Date.now() - t0);
  }
}

/** The old seam. Without AUTO_APPROVE nothing is ever approved here. */
export function autoCheck(_proof: Pick<Proof, "before" | "after" | "ticked" | "loadTotal">): "pass" | "needs-human" {
  return "needs-human";
}
/** The only place a verdict could ever lead to approval. Stays false. */
export const mayAutoApprove = (v: AiVerdict): boolean => AUTO_APPROVE && v.overall === "pass";
