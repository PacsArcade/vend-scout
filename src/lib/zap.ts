import dns from "dns/promises";
import net from "net";
import { verifyEvent } from "nostr-tools";

// Zaps are tips to the stocker. They go straight to the runner's Lightning address through LNURL-pay (and a NIP-57 zap request when the
// runner has a nostr key). They are NEVER job pay: nothing here touches a job, a proof, a payout or a credit.
export { ZAP_AMOUNTS, ZAP_MIN, ZAP_MAX } from "./zapconfig";
import { ZAP_MAX, ZAP_MIN } from "./zapconfig";

const privateV4 = (ip: string) => { const p = ip.split(".").map(Number); return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224; };
const privateIp = (ip: string) => (net.isIPv4(ip) ? privateV4(ip) : /^(::1?|fe80|fc|fd|::ffff:)/i.test(ip));

/** A host we may call: a real hostname (not an IP, not localhost) that resolves only to public addresses. */
export async function publicHost(host: string, lookup: (h: string) => Promise<{ address: string }[]> = (h) => dns.lookup(h, { all: true })): Promise<boolean> {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host) || net.isIP(host) || /(^|\.)localhost$|\.(local|internal|lan|home)$/i.test(host)) return false;
  try { const r = await lookup(host); return r.length > 0 && r.every((x) => !privateIp(x.address)); } catch { return false; }
}

interface PayParams { tag?: string; callback?: string; minSendable?: number; maxSendable?: number; allowsNostr?: boolean; nostrPubkey?: string }
export interface InvoiceResult { ok: boolean; pr?: string; error?: string; zap: boolean }

export interface ZapDeps { fetchImpl?: typeof fetch; lookup?: (h: string) => Promise<{ address: string }[]> }
async function getJson(url: string, f: typeof fetch): Promise<unknown> {
  const r = await f(url, { signal: AbortSignal.timeout(6000), redirect: "error", headers: { Accept: "application/json", "User-Agent": "VendScout/1.0 (Pac's Arcade)" } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const t = await r.text();
  if (t.length > 20_000) throw new Error("answer too large");
  return JSON.parse(t);
}

/** Ask a Lightning address for an invoice of amountSats. A signed zap request (kind 9734) is sent along when the wallet supports zaps and it checks out. */
export async function fetchInvoice(lud16: string, amountSats: number, zapRequest: unknown, runnerHex: string | null, deps: ZapDeps = {}): Promise<InvoiceResult> {
  const f = deps.fetchImpl ?? fetch;
  const m = lud16.trim().match(/^([a-z0-9._+-]{1,64})@([a-z0-9.-]{3,200})$/i);
  if (!m) return { ok: false, error: "That Lightning address does not look right", zap: false };
  if (!Number.isInteger(amountSats) || amountSats < ZAP_MIN || amountSats > ZAP_MAX) return { ok: false, error: `Pick between ${ZAP_MIN} and ${ZAP_MAX.toLocaleString("en-US")} sats`, zap: false };
  const msats = amountSats * 1000;
  try {
    if (!(await publicHost(m[2], deps.lookup))) return { ok: false, error: "That Lightning address host is not allowed", zap: false };
    const p = (await getJson(`https://${m[2]}/.well-known/lnurlp/${encodeURIComponent(m[1])}`, f)) as PayParams;
    if (p.tag !== "payRequest" || !p.callback) return { ok: false, error: "That wallet did not answer like a Lightning address", zap: false };
    const cb = new URL(p.callback);
    if (cb.protocol !== "https:" || !(await publicHost(cb.hostname, deps.lookup))) return { ok: false, error: "That wallet's invoice address is not allowed", zap: false };
    if (msats < (p.minSendable ?? 1000) || msats > (p.maxSendable ?? 1e12)) return { ok: false, error: "That amount is outside what this wallet takes", zap: false };
    cb.searchParams.set("amount", String(msats));
    let zap = false;
    const zr = zapRequest as { kind?: number; tags?: string[][]; pubkey?: string } | null;
    if (zr && p.allowsNostr && runnerHex) {
      const tag = (n: string) => zr.tags?.find((t) => t[0] === n)?.[1];
      const good = zr.kind === 9734 && tag("p") === runnerHex && tag("amount") === String(msats) && verifyEvent(zr as never);
      if (good) { cb.searchParams.set("nostr", JSON.stringify(zr)); zap = true; }
    }
    const inv = (await getJson(cb.toString(), f)) as { pr?: string; status?: string; reason?: string };
    if (!inv.pr || !/^ln(bc|tb|bcrt)/i.test(inv.pr)) return { ok: false, error: inv.reason ?? "The wallet did not give an invoice", zap };
    return { ok: true, pr: inv.pr, zap };
  } catch (e) {
    console.error(`[vend-zap] invoice failed: ${String((e as Error).message).slice(0, 120)}`);
    return { ok: false, error: "The wallet did not answer. Try again in a moment.", zap: false };
  }
}
