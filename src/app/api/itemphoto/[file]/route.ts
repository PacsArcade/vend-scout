import { readBin } from "@/lib/blobstore";
import { NextResponse } from "next/server";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export async function GET(_: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(file)) return new NextResponse("Not found", { status: 404 });
  const buf = await readBin(`items/${file}`);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": TYPES[file.split(".").pop()!], "Cache-Control": "no-store" } });
}
