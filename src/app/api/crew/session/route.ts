import { NextResponse } from "next/server";
import { welcomeDmFor } from "@/lib/welcome";
import { applicantFor } from "@/lib/crewauth";
import { CREW_COOKIE, crewPubkeyFromCookieHeader, makeCrewToken, verifySignedChallenge } from "@/lib/operator";
import { readState } from "@/lib/store";

// Crew sign-in with nostr (NIP-07): a fresh PACS-CREW-<ms> challenge signed by the key linked to an applicant who is On the crew.
export async function GET(req: Request) {
  let hex: string | null = null;
  try { hex = crewPubkeyFromCookieHeader(req.headers.get("cookie")); } catch { hex = null; }
  const ap = hex ? applicantFor((await readState()).applicants, hex) : null;
  return NextResponse.json({ ok: !!ap && ap.stage === "On the crew", id: ap?.id }, { status: ap ? 200 : 401 });
}
export async function POST(req: Request) {
  let body: { event?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "Bad request" }, { status: 400 }); }
  const r = verifySignedChallenge(body.event as any, "PACS-CREW");
  if (!r.ok) return NextResponse.json(r, { status: 403 });
  const ap = applicantFor((await readState()).applicants, r.pubkey);
  if (!ap) return NextResponse.json({ ok: false, reason: "That key is not linked to an application. Apply and add your npub, or ask us to link it." }, { status: 403 });
  if (ap.stage !== "On the crew") return NextResponse.json({ ok: false, reason: "You are not on the crew yet. Once you are, this key opens the crew pages." }, { status: 403 });
  let token: string;
  try { token = makeCrewToken(r.pubkey); } catch { return NextResponse.json({ ok: false, reason: "The site is missing its session secret. Tell the admin" }, { status: 500 }); }
  // The welcome DM runs on every sign-in (a short wait at most). With no sender key it is skipped and the text is shown instead.
  const dm = await Promise.race([welcomeDmFor(ap.id, new URL(req.url).origin), new Promise<null>((r) => setTimeout(() => r(null), 7000))]).catch(() => null);
  return NextResponse.json({ ok: true, id: ap.id, name: ap.name, lightning: ap.lightning ?? null, dm }, { headers: { "Set-Cookie": `${CREW_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` } });
}
export async function DELETE() {
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": `${CREW_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` } });
}
