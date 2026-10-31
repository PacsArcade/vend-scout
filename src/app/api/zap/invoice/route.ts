import { NextResponse } from "next/server";
import { npubToHex } from "@/lib/operator";
import { allow } from "@/lib/ratelimit";
import { latestProof } from "@/lib/social";
import { readState } from "@/lib/store";
import { fetchInvoice } from "@/lib/zap";

export const maxDuration = 30;

// A tip invoice for the person who stocked a machine. Tips only: this route never reads or writes a job, a proof or a payout.
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!allow(`zap:${ip}`, 20, 3600_000)) return NextResponse.json({ ok: false, error: "Too many tips from one place. Try again later." }, { status: 429 });
  let b: { machine?: string; amountSats?: number; zapRequest?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 }); }
  const st = await readState();
  const p = latestProof(st, String(b.machine ?? ""));
  const runner = p ? st.applicants.find((a) => a.id === p.by) : undefined;
  if (!runner?.lightning) return NextResponse.json({ ok: false, error: "This stocker has no tip address yet" }, { status: 404 });
  const r = await fetchInvoice(runner.lightning, Number(b.amountSats), b.zapRequest ?? null, runner.npub ? npubToHex(runner.npub) : null);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
