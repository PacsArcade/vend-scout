import { NextResponse } from "next/server";
import { gateOn, operatorFromCookieHeader } from "@/lib/operator";
import { owedLines, verifyRentApproval } from "@/lib/rent";
import { readState, recordRentApproval } from "@/lib/store";
import { currentHeight } from "@/lib/time";

// MONEY LAW: this only RECORDS an operator's signed approval. It sends nothing and calls no payment rail.
// The operator signs the line text in their own browser (NIP-07). The server recomputes the line itself and checks signature, operator key, amount, address and cap.
export async function POST(req: Request) {
  let op: string | null = null;
  try { op = operatorFromCookieHeader(req.headers.get("cookie")); } catch { op = null; }
  if (gateOn() && !op) return NextResponse.json({ ok: false, error: "Operators only. Sign in first." }, { status: 401 });
  let body: { event?: { tags?: string[][] } };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }
  const ev = body.event as Parameters<typeof verifyRentApproval>[0];
  const id = ev?.tags?.find((t) => t[0] === "d")?.[1] ?? "";
  const now = await currentHeight();
  if (!now.h) return NextResponse.json({ ok: false, error: "Block time is not available right now. Try again in a minute" }, { status: 503 });
  const st = await readState();
  const line = owedLines(st, now.h).find((l) => l.id === id);
  const v = verifyRentApproval(ev, line);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.reason }, { status: 400 });
  await recordRentApproval({ line: line!.id, sats: line!.sats, address: line!.address, eventId: String(ev.id), by: v.pubkey, at: new Date().toISOString(), h: now.h });
  return NextResponse.json({ ok: true, note: "Approved, not sent. There is no payment rail yet." });
}
