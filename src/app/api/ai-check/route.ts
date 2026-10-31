import { NextResponse } from "next/server";
import { perform, readState } from "@/lib/store";

export const maxDuration = 120;

// POST {proof}: run the photo checker now (used by the trial script and the "Run the AI check again" button).
// Shadow mode: this only records a suggestion on the proof. It never approves or pays.
export async function POST(req: Request) {
  const { proof } = (await req.json()) as { proof: string };
  const r = await perform({ action: "runAi", id: String(proof) });
  const p = (await readState()).proofs.find((x) => x.id === proof);
  return NextResponse.json({ ok: r.ok, error: r.error, verdict: p?.ai ?? null });
}
