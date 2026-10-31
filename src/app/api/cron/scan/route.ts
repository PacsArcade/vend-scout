import { NextResponse } from "next/server";
import { cronPlaces, runDailyScan } from "@/lib/cron";
import { placeAge, placeIsFresh, scanPlace } from "@/lib/overpass";
import { ILLINOIS, listPlaces } from "@/lib/places";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron calls this once a day with `Authorization: Bearer <CRON_SECRET>`. No secret set, or a wrong one: refused.
export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 401 });
  const summary = await runDailyScan({
    places: cronPlaces(await listPlaces(), ILLINOIS.map((c) => c.slug)), isFresh: placeIsFresh, ageOf: placeAge,
    scan: async (p) => { const r = await scanPlace(p); return { ok: r.ok, failed: r.failed, usedUnion: r.usedUnion }; },
    now: Date.now, budgetMs: 270_000, perCityMs: 110_000,
  });
  return NextResponse.json({ ok: true, ...summary });
}
