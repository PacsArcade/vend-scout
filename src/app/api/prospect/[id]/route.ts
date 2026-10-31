import { NextResponse } from "next/server";
import { addNote, advanceStage } from "@/lib/store";
import type { Stage } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { stage?: Stage; note?: string };
  if (body.stage) await advanceStage(id, body.stage);
  if (body.note) await addNote(id, body.note);
  return NextResponse.json({ ok: true });
}
