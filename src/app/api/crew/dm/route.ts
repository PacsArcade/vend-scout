import { NextResponse } from "next/server";
import { welcomeDmFor } from "@/lib/welcome";
import { applicantFor } from "@/lib/crewauth";
import { crewPubkeyFromCookieHeader, gateOn, operatorFromCookieHeader } from "@/lib/operator";
import { readState } from "@/lib/store";

export const maxDuration = 30;

// "Resend the DM": a signed-in crew member gets their own welcome again. An operator may name a crew id.
export async function POST(req: Request) {
  const st = await readState();
  let me = null as ReturnType<typeof applicantFor>;
  try { const hex = crewPubkeyFromCookieHeader(req.headers.get("cookie")); if (hex) me = applicantFor(st.applicants, hex); } catch { /* none */ }
  let op = false;
  try { op = !!operatorFromCookieHeader(req.headers.get("cookie")); } catch { op = false; }
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const who = me && me.stage === "On the crew" ? me : (op || !gateOn()) ? st.applicants.find((a) => a.id === body.id) : undefined;
  if (!who) return NextResponse.json({ ok: false, error: "Sign in with nostr first" }, { status: 401 });
  const r = await welcomeDmFor(who.id, new URL(req.url).origin, true);
  return NextResponse.json({ ok: true, ...r });
}
