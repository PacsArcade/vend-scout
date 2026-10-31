import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DIR = path.join(process.cwd(), "data", "stops");
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// POST multipart: route, file. Proof photo for a finished stop. Stored under data/stops (git-ignored).
export async function POST(req: Request) {
  const fd = await req.formData();
  const route = String(fd.get("route") ?? "");
  const file = fd.get("file");
  if (!/^r\d+$/.test(route) || !(file instanceof File)) return NextResponse.json({ ok: false, error: "A route and a photo are needed" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ ok: false, error: "Use a JPEG, PNG or WebP photo" }, { status: 400 });
  if (file.size > 8_000_000) return NextResponse.json({ ok: false, error: "That photo is over 8 MB" }, { status: 400 });
  await fs.mkdir(DIR, { recursive: true });
  const name = `${route}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, file: name });
}
