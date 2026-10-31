import { NextResponse } from "next/server";
import { actionAllowed, crewPubkeyFromCookieHeader, gateOn, operatorFromCookieHeader } from "@/lib/operator";
import { crewActionOk, crewFor } from "@/lib/crewauth";
import { allow } from "@/lib/ratelimit";
import { perform, readState, type Action } from "@/lib/store";

export async function POST(req: Request) {
  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  let op = false;
  try { op = !!operatorFromCookieHeader(req.headers.get("cookie")); } catch { op = false; }
  let crewHex: string | null = null;
  try { crewHex = crewPubkeyFromCookieHeader(req.headers.get("cookie")); } catch { crewHex = null; }
  const st0 = !op && crewHex ? await readState() : null;
  const me = st0 ? crewFor(st0.applicants, crewHex) : null;
  const gate = actionAllowed(String(body?.action), op, !!me);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  if (gateOn() && !op && me && st0 && !["apply", "hostPick"].includes(String(body.action))) {
    const ok = crewActionOk(st0, body as never, me);
    if (!ok.ok) return NextResponse.json({ ok: false, error: ok.error }, { status: 403 });
  }
  if (gateOn() && body.action === "apply") {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    if (!allow(`apply:${ip}`)) return NextResponse.json({ ok: false, error: "That is a lot of applications from one place. Try again later." }, { status: 429 });
  }
  let r: Awaited<ReturnType<typeof perform>>;
  try { r = await perform(body); }
  catch (e) { console.error(`[vend-store] action ${String(body?.action)} failed: ${String((e as Error).message).slice(0, 200)}`); return NextResponse.json({ ok: false, error: String((e as Error).message).slice(0, 200) }, { status: 500 }); }
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
