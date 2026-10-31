import { NextResponse } from "next/server";
import { makeNeighborToken, NEIGHBOR_COOKIE, neighborFromCookieHeader, verifySignedChallenge } from "@/lib/operator";
import { readState } from "@/lib/store";

// Neighbor sign-in: any nostr key signs a fresh PACS-NEIGHBOR-<ms> challenge. It proves the key is yours and nothing else.
export async function GET(req: Request) {
  let hex: string | null = null;
  try { hex = neighborFromCookieHeader(req.headers.get("cookie")); } catch { hex = null; }
  if (!hex) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, credits: (await readState()).credits[hex] ?? 0 });
}
export async function POST(req: Request) {
  let body: { event?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "Bad request" }, { status: 400 }); }
  const r = verifySignedChallenge(body.event as never, "PACS-NEIGHBOR");
  if (!r.ok) return NextResponse.json(r, { status: 403 });
  let token: string;
  try { token = makeNeighborToken(r.pubkey); } catch { return NextResponse.json({ ok: false, reason: "The site is missing its session secret. Tell the admin" }, { status: 500 }); }
  return NextResponse.json({ ok: true, credits: (await readState()).credits[r.pubkey] ?? 0 }, { headers: { "Set-Cookie": `${NEIGHBOR_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` } });
}
