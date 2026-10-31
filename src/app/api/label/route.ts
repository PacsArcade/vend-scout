import { writeBin } from "@/lib/blobstore";
import { NextResponse } from "next/server";
import { setLabelPhoto } from "@/lib/store";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// POST multipart: machine, file (jpeg, png or webp, 8 MB at most). Stored under data/labels (git-ignored).
export async function POST(req: Request) {
  const fd = await req.formData();
  const machine = String(fd.get("machine") ?? "");
  const file = fd.get("file");
  if (!/^m\d+$/.test(machine) || !(file instanceof File)) return NextResponse.json({ ok: false, error: "A machine and a photo are needed" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ ok: false, error: "Use a JPEG, PNG or WebP photo" }, { status: 400 });
  if (file.size > 8_000_000) return NextResponse.json({ ok: false, error: "That photo is over 8 MB" }, { status: 400 });
  const name = `${machine}-${Date.now()}.${ext}`;
  await writeBin(`labels/${name}`, Buffer.from(await file.arrayBuffer()), file.type);
  const ok = await setLabelPhoto(machine, name);
  return NextResponse.json({ ok, error: ok ? undefined : "No such machine" }, { status: ok ? 200 : 404 });
}
