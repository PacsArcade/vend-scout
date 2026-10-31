import { writeBin } from "@/lib/blobstore";
import { NextResponse } from "next/server";

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
  const name = `${route}-${Date.now()}.${ext}`;
  await writeBin(`stops/${name}`, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ ok: true, file: name });
}
