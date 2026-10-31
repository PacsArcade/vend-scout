import { NextResponse } from "next/server";
import { perform, type Action } from "@/lib/store";

export async function POST(req: Request) {
  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const r = await perform(body);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
