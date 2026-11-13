import { NextResponse } from "next/server";
import { nip19 } from "nostr-tools";
import { allow, clientKey } from "@/lib/ratelimit";
import { readState, recordVerifySig } from "@/lib/store";
import { currentHeight } from "@/lib/time";
import { keyFromParam, summaryFor } from "@/lib/vendprofile";
import { checkSigned, viewFor } from "@/lib/verifycode";

export const dynamic = "force-dynamic";
const npubOf = (h: string) => nip19.npubEncode(h);
const noStore = { headers: { "Cache-Control": "no-store" } };

// Public. GET: the current code and what has been signed. POST: a signed code event from the crew member's browser. It is checked here and never sent to a relay.
export async function GET(req: Request, ctx: { params: Promise<{ npub: string }> }) {
  const key = keyFromParam((await ctx.params).npub);
  if (!key) return NextResponse.json({ ok: false, error: "Not a nostr key" }, { status: 404 });
  if (!allow(`vget:${clientKey(req)}`, 120, 600_000)) return NextResponse.json({ ok: false, error: "Slow down" }, { status: 429 });
  const st = await readState();
  const s = summaryFor(st, key.hex);
  return NextResponse.json({ ok: true, ...viewFor(key.hex, s.onCrew, st.verifySigs?.[key.hex], Date.now(), npubOf) }, noStore);
}

export async function POST(req: Request, ctx: { params: Promise<{ npub: string }> }) {
  const key = keyFromParam((await ctx.params).npub);
  if (!key) return NextResponse.json({ ok: false, error: "Not a nostr key" }, { status: 404 });
  // Attempts are capped per visitor and per page, so nobody can guess codes or fill the store.
  if (!allow(`vsign-ip:${clientKey(req)}`, 12, 600_000) || !allow(`vsign-key:${key.hex}`, 30, 600_000)) return NextResponse.json({ ok: false, error: "Too many tries. Wait a few minutes" }, { status: 429 });
  let body: { event?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }
  const st = await readState();
  const onCrew = summaryFor(st, key.hex).onCrew;
  const res = checkSigned(body.event as never, { targetHex: key.hex, onCrew, last: st.verifySigs?.[key.hex] });
  const h = (await currentHeight()).h || undefined;
  if (!res.ok) {
    if (res.wrong) await recordVerifySig(key.hex, { wrong: { ...res.wrong, h } });
    return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
  }
  await recordVerifySig(key.hex, { ok: { ...res.record, h } });
  return NextResponse.json({ ok: true });
}
