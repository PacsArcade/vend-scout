import { NextResponse } from "next/server";
import { errText } from "@/lib/blobstore";
import { stampString } from "@/components/Bft";
import { isOperatorNow } from "@/lib/auth";
import { STORAGE_MISSING, storageMissing } from "@/lib/blobstore";
import { scanPlace } from "@/lib/overpass";
import { getPlace } from "@/lib/places";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Operators only. Scans one place and streams a line of JSON as each category lands, so the map can fill in as it goes.
export async function GET(req: Request) {
  if (!(await isOperatorNow())) return NextResponse.json({ ok: false, error: "Operators only. Sign in first." }, { status: 401 });
  const u = new URL(req.url);
  const place = await getPlace(u.searchParams.get("place") ?? "chicago");
  if (!place) return NextResponse.json({ ok: false, error: "Unknown place" }, { status: 404 });
  if (storageMissing()) return NextResponse.json({ ok: false, error: STORAGE_MISSING, storageMissing: true }, { status: 503 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      let open = true;
      // If the browser went away, keep scanning (the results are saved) but stop writing to the closed stream.
      const send = (o: unknown) => { if (!open) return; try { ctl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { open = false; } };
      try {
        send({ t: "start" });
        const r = await scanPlace(place, { force: u.searchParams.get("force") === "1", dropMs: 140, onCategory: (c, count) => send({ t: "cat", c, count }), onNote: (msg) => send({ t: "note", msg }) });
        send({ t: "done", ok: r.ok, skipped: r.skipped, usedUnion: r.usedUnion, failed: r.failed, errors: r.errors, source: r.source, stamp: r.extractedAt ? await stampString(new Date(r.extractedAt).toISOString()) : undefined });
      } catch (e) { console.error(`[vend-scan] stream for ${place.slug} crashed ${errText(e)}`); send({ t: "done", ok: false, failed: ["all"], errors: [errText(e)] }); }
      try { ctl.close(); } catch { /* already closed */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
