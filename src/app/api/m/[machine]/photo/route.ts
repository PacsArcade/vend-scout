import { NextResponse } from "next/server";
import { readBin } from "@/lib/blobstore";
import { latestProof } from "@/lib/social";
import { readState } from "@/lib/store";

// Public on purpose: the neighbor page is for a person standing at the machine. Only the AFTER photo of the newest proof is served, nothing else.
export async function GET(_: Request, ctx: { params: Promise<{ machine: string }> }) {
  const { machine } = await ctx.params;
  const p = latestProof(await readState(), machine);
  if (!p || !/^r\d+-\d+\.(jpg|png|webp)$/.test(p.after)) return new NextResponse("No photo yet", { status: 404 });
  const buf = await readBin(`stops/${p.after}`);
  if (!buf) return new NextResponse("No photo yet", { status: 404 });
  const type = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[p.after.split(".").pop() as "jpg"];
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=60" } });
}
