import { NextResponse } from "next/server";
import { publishSigned } from "@/lib/badgecheck";
import { earnedBadges } from "@/lib/badges";
import { publishToRelays } from "@/lib/dm";
import { gateOn, operatorFromCookieHeader } from "@/lib/operator";
import { originFrom } from "@/lib/origin";
import { readState, recordBadgePublished } from "@/lib/store";
import { currentHeight } from "@/lib/time";
import type { NostrEvent } from "nostr-tools";

// Operator only. The body is an event the operator ALREADY signed in their own browser (NIP-07). The server checks it and sends it on to the app's relay list.
// This route never signs and never holds a key. Nothing goes out unless the operator pressed the button and signed.
export async function POST(req: Request) {
  let op: string | null = null;
  try { op = operatorFromCookieHeader(req.headers.get("cookie")); } catch { op = null; }
  if (gateOn() && !op) return NextResponse.json({ ok: false, error: "Operators only. Sign in first." }, { status: 401 });
  let body: { event?: Parameters<typeof publishSigned>[0] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }
  const st = await readState();
  const h = (await currentHeight()).h || undefined;
  const r = await publishSigned(body.event as never, { origin: originFrom(req.headers), earned: earnedBadges(st), publish: (ev) => publishToRelays(ev as NostrEvent), h });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.reason }, { status: 400 });
  await recordBadgePublished(r.key, r.rec);
  return NextResponse.json({ ok: true, relays: r.rec.relays });
}
