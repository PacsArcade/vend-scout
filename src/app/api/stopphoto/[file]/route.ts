import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!/^r\d+-\d+\.(jpg|png|webp)$/.test(file)) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "data", "stops", file));
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": TYPES[file.split(".").pop()!], "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
