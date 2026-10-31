import { NextResponse } from "next/server";
import { makeOperatorToken, OPERATOR_COOKIE, operatorFromCookieHeader, operatorsConfigured, verifyOperatorLogin } from "@/lib/operator";

export async function GET(req: Request) {
  let op: string | null = null;
  try { op = operatorFromCookieHeader(req.headers.get("cookie")); } catch { op = null; }
  return NextResponse.json({ ok: !!op, configured: operatorsConfigured() }, { status: op ? 200 : 401 });
}

// Sign in: a fresh PACS-CONSOLE-<ms> challenge signed by a key on OPERATOR_NPUBS.
export async function POST(req: Request) {
  let body: { event?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, reason: "Bad request" }, { status: 400 }); }
  const r = verifyOperatorLogin(body.event as any);
  if (!r.ok) return NextResponse.json(r, { status: 403 });
  let token: string;
  try { token = makeOperatorToken(r.pubkey); } catch { return NextResponse.json({ ok: false, reason: "The site is missing its session secret. Tell the admin" }, { status: 500 }); }
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": `${OPERATOR_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` } });
}
