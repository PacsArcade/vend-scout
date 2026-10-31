import { NextResponse } from "next/server";
import { findProspect } from "@/lib/overpass";
import { findContacts, isSocialHost, normalizeUrl, osmContacts, readCached } from "@/lib/contacts";

export const maxDuration = 120;

// POST {id}  fetches the place's own website (robots.txt respected, 3 pages at most) and caches it.
// GET ?id=   returns what is known without any network call.
export async function POST(req: Request) {
  const { id } = (await req.json()) as { id: string };
  const hit = await findProspect(String(id));
  if (!hit) return NextResponse.json({ ok: false, error: "No such place" }, { status: 404 });
  const site = normalizeUrl(hit.prospect.tags.website ?? "");
  if (!site) return NextResponse.json({ ok: false, error: "This place has no website on the map" }, { status: 400 });
  if (isSocialHost(site)) return NextResponse.json({ ok: true, skipped: true, message: "Its website is a social page, which we do not read." });
  const r = await findContacts(site);
  return NextResponse.json({ ok: true, count: r.contacts.length, note: r.note });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const hit = await findProspect(id);
  if (!hit) return NextResponse.json({ ok: false }, { status: 404 });
  const site = normalizeUrl(hit.prospect.tags.website ?? "");
  const cached = site ? await readCached(site) : null;
  return NextResponse.json({ ok: true, osm: osmContacts(hit.prospect.tags), site: cached });
}
