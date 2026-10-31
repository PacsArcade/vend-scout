import { NextResponse } from "next/server";
import { searchPlace } from "@/lib/places";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const p = await searchPlace(q.slice(0, 120));
    if (!p) return NextResponse.json({ ok: false, error: "No place found for that search" }, { status: 404 });
    return NextResponse.json({ ok: true, place: p });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Place search failed: " + String(e) }, { status: 502 });
  }
}
