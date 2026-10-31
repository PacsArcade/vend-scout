import { writeBin } from "@/lib/blobstore";
import { NextResponse } from "next/server";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// POST multipart: file. A reference photo for a catalog item. Stored under data/items (git-ignored).
export async function POST(req: Request) {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "A photo is needed" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ ok: false, error: "Use a JPEG, PNG or WebP photo" }, { status: 400 });
  if (file.size > 8_000_000) return NextResponse.json({ ok: false, error: "That photo is over 8 MB" }, { status: 400 });
  const name = `i0-${Date.now()}.${ext}`;
  await writeBin(`items/${name}`, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ ok: true, file: name });
}
