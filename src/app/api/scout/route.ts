import { NextResponse } from "next/server";
import { getCategory } from "@/lib/overpass";
import { CATEGORIES } from "@/lib/types";

export const maxDuration = 300;

// GET /api/scout            cached counts only
// GET /api/scout?refresh=1  goes live, at most once per category per day (cache gate)
export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const result: Record<string, { count: number; fetchedAt: string | null; live: boolean; error?: string }> = {};
  for (const c of CATEGORIES) {
    const r = await getCategory(c, refresh);
    result[c] = { count: r.items.length, fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : null, live: r.live, error: r.error };
  }
  return NextResponse.json(result);
}
