import { NextResponse } from "next/server";
import { credentials, STORAGE_MISSING, storageMissing, storageProbe } from "@/lib/blobstore";
import { cacheCounts } from "@/lib/overpass";
import { ILLINOIS } from "@/lib/places";

// Operators only (the proxy gates /api/admin/* except the session route). Writes a probe file, reads it back, and lists what the scan caches hold.
export async function GET() {
  if (storageMissing()) return NextResponse.json({ ok: false, error: STORAGE_MISSING, probe: { driver: "none", wrote: false, read: false, match: false, error: STORAGE_MISSING }, counts: {}, credentials: "none" }, { headers: { "Cache-Control": "no-store" } });
  const probe = await storageProbe();
  const counts: Record<string, Record<string, number | null>> = {};
  for (const p of ILLINOIS.slice(0, 2)) counts[p.slug] = await cacheCounts(p.slug);
  return NextResponse.json({ ok: probe.wrote && probe.match, probe, counts, credentials: credentials() }, { headers: { "Cache-Control": "no-store" } });
}
