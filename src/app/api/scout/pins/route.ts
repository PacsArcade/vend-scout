import { NextResponse } from "next/server";
import { buildPins } from "@/lib/pins";
import { getPlace } from "@/lib/places";

// Public and read-only: the pins for one place, no contacts. The scout map polls this while a scan drops results in.
export async function GET(req: Request) {
  const place = await getPlace(new URL(req.url).searchParams.get("place") ?? "chicago");
  if (!place) return NextResponse.json({ ok: false }, { status: 404 });
  const { pins, total } = await buildPins(place.slug);
  return NextResponse.json({ ok: true, pins, total }, { headers: { "Cache-Control": "no-store" } });
}
