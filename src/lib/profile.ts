import { validLightning } from "./lightning";

// Read a nostr profile (kind 0) and pick out lud16, the Lightning address. Browser side, a few public relays, short timeout.
export const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

/** Pure part: pull a valid Lightning address out of kind 0 content. Anything odd gives null. */
export function lud16FromProfile(content: string): string | null {
  try {
    const j = JSON.parse(content) as { lud16?: unknown };
    if (typeof j.lud16 !== "string") return null;
    const v = validLightning(j.lud16);
    return v.ok && v.value.includes("@") ? v.value : null;
  } catch { return null; }
}

export async function fetchLud16(pubkey: string, timeoutMs = 4000): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false, open = RELAYS.length;
    const socks: WebSocket[] = [];
    const finish = (v: string | null) => { if (done) return; done = true; for (const s of socks) { try { s.close(); } catch { /* closed */ } } resolve(v); };
    const timer = setTimeout(() => finish(null), timeoutMs);
    for (const url of RELAYS) {
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { if (--open === 0) { clearTimeout(timer); finish(null); } continue; }
      socks.push(ws);
      ws.onopen = () => ws.send(JSON.stringify(["REQ", "vsprof", { kinds: [0], authors: [pubkey], limit: 1 }]));
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data)) as unknown[];
          if (msg[0] === "EVENT" && msg[2] && typeof (msg[2] as { content?: unknown }).content === "string") {
            const v = lud16FromProfile((msg[2] as { content: string }).content);
            if (v) { clearTimeout(timer); finish(v); }
          }
        } catch { /* ignore */ }
      };
      const fail = () => { if (--open === 0) { clearTimeout(timer); finish(null); } };
      ws.onerror = fail; ws.onclose = () => { /* counted by error or timeout */ };
    }
  });
}
