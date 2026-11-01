// Crew names: <name>.vend on frens.earth. Seated when an operator moves an applicant On the crew, released when they leave.
// SERVER ONLY. The shared secret (env FRENS_SUBNAME_SECRET_VEND) is read here and sent in a header to frens.earth.
// It is never returned to a page, never put in an error message, never logged. A frens outage never breaks the crew flow:
// 5 second timeout, and every call returns a plain result instead of throwing.
import { ANCHORED_LINE, OFF_LINE, SECRET_ENV_NAME } from "./crewname";
export { ANCHORED_LINE, NAME_RULES, OFF_LINE, SECRET_ENV_NAME, handleOf, slugCrewName, validCrewName } from "./crewname";
const BASE = () => process.env.FRENS_API_BASE || "https://frens.earth"; // the frens.earth API origin
const TIMEOUT_MS = 5000;

export const namesOn = () => !!process.env[SECRET_ENV_NAME];

export type SubnameResult =
  | { ok: true }
  | { ok: false; kind: "off" | "taken" | "anchored" | "bad" | "timeout" | "busy" | "error"; reason: string };

async function call(method: "POST" | "DELETE", body: object, f: typeof fetch): Promise<SubnameResult> {
  const secret = process.env[SECRET_ENV_NAME];
  if (!secret) return { ok: false, kind: "off", reason: OFF_LINE };
  try {
    const res = await f(`${BASE()}/api/registry/subname`, { method, headers: { "Content-Type": "application/json", "x-frens-subname-secret": secret }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return { ok: true };
    const reason = String(((await res.json().catch(() => null)) as { reason?: string } | null)?.reason ?? `frens.earth answered ${res.status}`).slice(0, 200);
    console.error(`[vend-names] ${method} answered ${res.status}`);
    if (res.status === 409) return method === "DELETE" ? { ok: false, kind: "anchored", reason: ANCHORED_LINE } : { ok: false, kind: "taken", reason: "That name is taken. Pick another." };
    if (res.status === 400) return { ok: false, kind: "bad", reason };
    if (res.status === 401 || res.status === 503) return { ok: false, kind: "busy", reason: res.status === 401 ? "frens.earth did not accept the secret. Check it matches on both projects." : "frens.earth has crew names switched off for now." };
    if (res.status === 429) return { ok: false, kind: "busy", reason: "Too many calls just now. Try again in a minute." };
    return { ok: false, kind: "error", reason };
  } catch (e) {
    const timeout = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
    console.error(`[vend-names] ${method} ${timeout ? "timed out" : "failed"}`);
    return { ok: false, kind: timeout ? "timeout" : "error", reason: timeout ? "frens.earth did not answer in 5 seconds. Try again." : "Could not reach frens.earth. Try again." };
  }
}
export const seatSubname = (name: string, npub: string, f: typeof fetch = fetch) => call("POST", { parent: "vend", name, npub }, f);
export const releaseSubname = (name: string, f: typeof fetch = fetch) => call("DELETE", { parent: "vend", name }, f);
