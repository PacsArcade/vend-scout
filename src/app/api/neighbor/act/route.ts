import { NextResponse } from "next/server";
import { neighborFromCookieHeader } from "@/lib/operator";
import { allow } from "@/lib/ratelimit";
import { shareNoteOk } from "@/lib/social";
import { perform, readState } from "@/lib/store";

// What a signed-in neighbor can do: verify, report a problem, request items, claim share credits. Nothing here approves a proof or pays anyone.
export async function POST(req: Request) {
  let hex: string | null = null;
  try { hex = neighborFromCookieHeader(req.headers.get("cookie")); } catch { hex = null; }
  if (!hex) return NextResponse.json({ ok: false, error: "Sign in with nostr first" }, { status: 401 });
  if (!allow(`nb:${hex}`, 40, 3600_000)) return NextResponse.json({ ok: false, error: "That is a lot in a short time. Try again later." }, { status: 429 });
  let b: { action?: string; machine?: string; reason?: string; text?: string; event?: Record<string, unknown> };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }
  const machine = String(b.machine ?? "");
  if (!(await readState()).machines.some((m) => m.id === machine)) return NextResponse.json({ ok: false, error: "No such machine" }, { status: 404 });
  let r;
  switch (b.action) {
    case "verify": r = await perform({ action: "neighborVerify", machine, npub: hex }); break;
    case "report": r = await perform({ action: "neighborReport", machine, npub: hex, reason: String(b.reason ?? ""), text: String(b.text ?? "") }); break;
    case "request": r = await perform({ action: "requestItems", machine, npub: hex, text: String(b.text ?? "") }); break;
    case "share": {
      const bad = shareNoteOk((b.event ?? {}) as never, hex, machine);
      if (bad) return NextResponse.json({ ok: false, error: bad }, { status: 400 });
      r = await perform({ action: "shareCredit", machine, npub: hex });
      break;
    }
    default: return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ...r, credits: (await readState()).credits[hex] ?? 0 }, { status: r.ok ? 200 : 400 });
}
