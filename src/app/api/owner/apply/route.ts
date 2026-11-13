import { NextResponse } from "next/server";
import { sessionKeyFromCookies } from "@/lib/profilesession";
import { perform } from "@/lib/store";
import { allow } from "@/lib/ratelimit";

// An owner (host) application. The key comes from the signed sign-in cookie, never from the body.
export async function POST(req: Request) {
  let body: { input?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }
  const me = sessionKeyFromCookies(req.headers.get("cookie"));
  if (!me) return NextResponse.json({ ok: false, error: "Sign in with nostr first." }, { status: 401 });
  if (!allow(`owner:${me}`, 10)) return NextResponse.json({ ok: false, error: "Too many tries. Try again in a bit." }, { status: 429 });
  const r = await perform({ action: "hostApply", keyHex: me, input: body.input ?? {} });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
