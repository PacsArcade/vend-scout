import { NextResponse } from "next/server";
import { actionAllowed, operatorFromCookieHeader, gateOn } from "@/lib/operator";
import { allow } from "@/lib/ratelimit";
import { perform, type Action } from "@/lib/store";

export async function POST(req: Request) {
  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  let op = false;
  try { op = !!operatorFromCookieHeader(req.headers.get("cookie")); } catch { op = false; }
  const gate = actionAllowed(String(body?.action), op);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  if (gateOn() && body.action === "apply") {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    if (!allow(`apply:${ip}`)) return NextResponse.json({ ok: false, error: "That is a lot of applications from one place. Try again later." }, { status: 429 });
  }
  const r = await perform(body);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
