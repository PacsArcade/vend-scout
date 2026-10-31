import { NextResponse } from "next/server";
import { openJobs } from "@/lib/jobs";
import { offersFor, zonesOf } from "@/lib/offers";
import { ILLINOIS, cityCenter } from "@/lib/places";
import { perform, readState } from "@/lib/store";

// GET ?crew=a201&lat=..&lon=.. returns the offers this worker can see right now, pay up front, and the busy zones.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const crew = u.searchParams.get("crew") ?? "";
  const lat = Number(u.searchParams.get("lat")), lon = Number(u.searchParams.get("lon"));
  const st = await readState();
  const { jobs } = await openJobs(st);
  // first time we see a job, remember when. The first-look window counts from there.
  const unseen = jobs.filter((j) => st.seen[j.id] === undefined);
  if (unseen.length) await perform({ action: "seenJobs", ids: unseen.map((j) => j.id) });
  const st2 = unseen.length ? await readState() : st;
  const centers = Object.fromEntries(ILLINOIS.map((c) => [c.slug, cityCenter(c)]));
  const loc = Number.isFinite(lat) && Number.isFinite(lon) && u.searchParams.has("lat") ? { lat, lon } : null;
  return NextResponse.json({ ok: true, offers: offersFor(st2, jobs, crew, loc, Date.now(), centers).slice(0, 10), zones: zonesOf(jobs), online: !!st2.online[crew] });
}
