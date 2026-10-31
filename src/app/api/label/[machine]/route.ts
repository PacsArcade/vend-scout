import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { readState } from "@/lib/store";

const DIR = path.join(process.cwd(), "data", "labels");
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_: Request, ctx: { params: Promise<{ machine: string }> }) {
  const { machine } = await ctx.params;
  const m = (await readState()).machines.find((x) => x.id === machine);
  const f = m?.profile.labelPhoto;
  if (!f || f.includes("/") || f.includes("..")) return new NextResponse("No label photo", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(DIR, f));
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": TYPES[f.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse("No label photo", { status: 404 });
  }
}
