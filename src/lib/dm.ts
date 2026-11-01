import { decode } from "nostr-tools/nip19";
import { wrapEvent } from "nostr-tools/nip17";
import type { NostrEvent } from "nostr-tools";
import { RELAYS } from "./profile";

// The welcome DM. A private message (NIP-17, sealed and gift wrapped) from the house sender key.
// The key is the env var VEND_DM_SENDER_KEY (an nsec or 64 hex characters), set by the Admiral. This code never generates, stores or prints it.
// With no key set the DM is not sent: the text is shown in the app instead and "dm skipped: no sender key" is logged.
export const SKIPPED = "dm skipped: no sender key";

export function senderKey(): Uint8Array | null {
  const v = (process.env.VEND_DM_SENDER_KEY ?? "").trim();
  if (!v) return null;
  try {
    if (v.startsWith("nsec1")) { const d = decode(v); return d.type === "nsec" ? d.data : null; }
    if (/^[0-9a-fA-F]{64}$/.test(v)) return Uint8Array.from(Buffer.from(v, "hex"));
  } catch { /* fall through */ }
  return null;
}

export function welcomeText(o: { name: string; jobTitle?: string; sats?: number; url: string; crewHandle?: string }): string {
  const first = o.name.trim().split(/\s+/)[0] || "there";
  const job = o.jobTitle ? `Your first open job is ready: ${o.jobTitle}. Photo proof, then your sats land after it is checked.${o.sats ? ` Pay ${o.sats.toLocaleString("en-US")} sats (test).` : ""}` : "No job is open right now. We will message you when one is.";
  return `Welcome to the Vend Scout crew, ${first}. You signed in with nostr, so we are saying hello here and not by email. Your jobs are here: ${o.url} ${job}${o.crewHandle ? ` Your crew name is ${o.crewHandle}.` : ""}`;
}

/** Publish an event to a few public relays. Returns how many accepted it. Short timeout. Never throws. */
export async function publishToRelays(ev: NostrEvent, relays: string[] = RELAYS, ms = 5000): Promise<number> {
  let ok = 0;
  await Promise.all(relays.map((url) => new Promise<void>((resolve) => {
    let ws: WebSocket;
    const done = () => { try { ws?.close(); } catch { /* closed */ } resolve(); };
    const t = setTimeout(done, ms);
    try { ws = new WebSocket(url); } catch { clearTimeout(t); return resolve(); }
    ws.onopen = () => ws.send(JSON.stringify(["EVENT", ev]));
    ws.onmessage = (m) => { try { const j = JSON.parse(String(m.data)) as unknown[]; if (j[0] === "OK" && j[1] === ev.id) { if (j[2] === true) ok++; clearTimeout(t); done(); } } catch { /* ignore */ } };
    ws.onerror = () => { clearTimeout(t); done(); };
  })));
  return ok;
}

export interface DmResult { sent: boolean; skipped?: string; relays?: number; text: string }
/** Compose and send the welcome DM to a pubkey (hex). With no sender key: skip, log, and hand the text back to show in the app. */
export async function sendWelcomeDm(recipientHex: string, text: string, publish: (ev: NostrEvent) => Promise<number> = publishToRelays): Promise<DmResult> {
  const sk = senderKey();
  if (!sk) { console.info(`[vend-dm] ${SKIPPED}`); return { sent: false, skipped: SKIPPED, text }; }
  try {
    const wrap = wrapEvent(sk, { publicKey: recipientHex }, text);
    const n = await publish(wrap);
    if (n === 0) { console.error("[vend-dm] no relay accepted the message"); return { sent: false, skipped: "no relay accepted the message", relays: 0, text }; }
    return { sent: true, relays: n, text };
  } catch (e) {
    console.error(`[vend-dm] send failed: ${String((e as Error).message).slice(0, 120)}`);
    return { sent: false, skipped: "the message could not be sent", text };
  }
}
