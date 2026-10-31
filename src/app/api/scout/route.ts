import { NextResponse } from "next/server";
import { driver } from "@/lib/blobstore";
import { isOperatorNow } from "@/lib/auth";
import { cacheCounts, getCategory } from "@/lib/overpass";
import { getPlace } from "@/lib/places";
import { ALL_CATEGORIES, type Category } from "@/lib/types";

export const maxDuration = 300;

// GET /api/scout?place=chicago                   cached counts only
// GET /api/scout?place=chicago&cat=gym&refresh=1 one category, live only if the cache is over a day old
export async function GET(req: Request) {
  const u = new URL(req.url);
  const place = await getPlace(u.searchParams.get("place") ?? "chicago");
  if (!place) return NextResponse.json({ ok: false, error: "Unknown place" }, { status: 404 });
  const cat = u.searchParams.get("cat") as Category | null;
  if (cat) {
    if (!ALL_CATEGORIES.includes(cat)) return NextResponse.json({ ok: false, error: "Unknown category" }, { status: 400 });
    const refresh = u.searchParams.get("refresh") === "1";
    if (refresh && !(await isOperatorNow())) return NextResponse.json({ ok: false, error: "Operators only. Sign in first." }, { status: 401 });
    const r = await getCategory(place, cat, refresh);
    if (r.error) console.error(`[vend-scan] /api/scout ${cat} for ${place.slug} -> ${r.error}`);
    return NextResponse.json({ ok: !r.error, count: r.items.length, live: r.live, error: r.error });
  }
  return NextResponse.json({ ok: true, driver: driver(), counts: await cacheCounts(place.slug) });
}
