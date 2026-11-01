import { NextResponse } from "next/server";
import { errText } from "@/lib/blobstore";
import { stampString } from "@/components/Bft";
import { isOperatorNow } from "@/lib/auth";
import { STORAGE_MISSING, storageMissing } from "@/lib/blobstore";
import { placeIsFresh, scanPlace } from "@/lib/overpass";
import { getPlace } from "@/lib/places";
import { NEW_PLACES_PER_HOUR, allow, clientKey } from "@/lib/ratelimit";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Scans one place and streams a line of JSON as each category lands, so the map can fill in as it goes.
// Operators get the full scan (our copy, then Overpass). Anyone else gets OUR COPIES ONLY (the bundled Illinois files and the USA state files),
// so a public visit can never reach Overpass. A new place costs a visitor one of 5 loads an hour per address (in memory, see ratelimit.ts).
export async function GET(req: Request) {
  const op = await isOperatorNow();
  const u = new URL(req.url);
  const place = await getPlace(u.searchParams.get("place") ?? "chicago");
  if (!place) return NextResponse.json({ ok: false, error: "Unknown place" }, { status: 404 });
  if (storageMissing()) return NextResponse.json({ ok: false, error: STORAGE_MISSING, storageMissing: true }, { status: 503 });
  if (!op && !(await placeIsFresh(place.slug))) {
    if (!allow(`new-place:${clientKey(req)}`, NEW_PLACES_PER_HOUR, 3_600_000)) return NextResponse.json({ ok: false, limited: true, error: `You have loaded ${NEW_PLACES_PER_HOUR} new places in the last hour, which is the limit. Try again in a little while. Places that are already loaded are still free to open.` }, { status: 429 });
  }
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      let open = true;
      // If the browser went away, keep scanning (the results are saved) but stop writing to the closed stream.
      const send = (o: unknown) => { if (!open) return; try { ctl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { open = false; } };
      try {
        send({ t: "start" });
        const r = await scanPlace(place, { copyOnly: !op, force: op && u.searchParams.get("force") === "1", dropMs: 140, onCategory: (c, count) => send({ t: "cat", c, count }), onNote: (msg) => send({ t: "note", msg }) });
        send({ t: "done", ok: r.ok, skipped: r.skipped, usedUnion: r.usedUnion, failed: r.failed, errors: r.errors, source: r.source, notLoaded: r.notLoaded, stamp: r.extractedAt ? await stampString(new Date(r.extractedAt).toISOString()) : undefined });
      } catch (e) { console.error(`[vend-scan] stream for ${place.slug} crashed ${errText(e)}`); send({ t: "done", ok: false, failed: ["all"], errors: [errText(e)] }); }
      try { ctl.close(); } catch { /* already closed */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
