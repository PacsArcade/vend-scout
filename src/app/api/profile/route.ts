import { NextResponse } from "next/server";
import { profileActionOk, keyFromParam } from "@/lib/vendprofile";
import { sessionKeyFromCookies } from "@/lib/profilesession";
import { perform } from "@/lib/store";
import { allow } from "@/lib/ratelimit";

// Save the vend.frens only fields of a profile. A key may only save its own. The key comes from the signed cookie, never from the body.
export async function POST(req: Request) {
  let body: { pubkey?: string; fields?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }
  const me = sessionKeyFromCookies(req.headers.get("cookie"));
  const target = body.pubkey ? keyFromParam(String(body.pubkey))?.hex ?? "bad" : null;
  const ok = profileActionOk(me, target);
  if (!ok.ok) return NextResponse.json({ ok: false, error: ok.error }, { status: me ? 403 : 401 });
  if (!allow(`profile:${me}`, 30)) return NextResponse.json({ ok: false, error: "Too many saves. Try again in a bit." }, { status: 429 });
  const f = body.fields ?? {};
  const r = await perform({ action: "saveProfile", pubkey: me!, fields: { blurb: f.blurb as string, availability: f.availability as string, showArea: f.showArea as boolean, showJobs: f.showJobs as boolean } });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
