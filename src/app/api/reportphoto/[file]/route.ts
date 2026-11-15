import { NextResponse } from "next/server";
import { isOperatorNow } from "@/lib/auth";
import { readBin } from "@/lib/blobstore";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// r23: the picture sent with a public report. Operators only: this path is not in PUBLIC_API, and the handler checks again.
export async function GET(_: Request, ctx: { params: Promise<{ file: string }> }) {
  if (!(await isOperatorNow())) return new NextResponse("Operators only", { status: 401 });
  const { file } = await ctx.params;
  if (!/^rp-\d+-[0-9a-f]{8}\.(jpg|png|webp)$/.test(file)) return new NextResponse("Not found", { status: 404 });
  const buf = await readBin(`reports/${file}`);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": TYPES[file.split(".").pop()!], "Cache-Control": "private, no-store" } });
}
