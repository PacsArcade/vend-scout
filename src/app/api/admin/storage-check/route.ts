import { NextResponse } from "next/server";
import { storageProbe } from "@/lib/blobstore";
import { cacheCounts } from "@/lib/overpass";
import { ILLINOIS } from "@/lib/places";

// Operators only (the proxy gates /api/admin/* except the session route). Writes a probe file, reads it back, and lists what the scan caches hold.
export async function GET() {
  const probe = await storageProbe();
  const counts: Record<string, Record<string, number | null>> = {};
  for (const p of ILLINOIS.slice(0, 2)) counts[p.slug] = await cacheCounts(p.slug);
  return NextResponse.json({ ok: probe.wrote && probe.match, probe, counts, hasToken: !!process.env.BLOB_READ_WRITE_TOKEN }, { headers: { "Cache-Control": "no-store" } });
}
