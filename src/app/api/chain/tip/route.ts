import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Vend Scout's own tip door. First frens.earth's tip (with the block's own timestamp), then the house time service.
// Never throws. Total failure returns ok:false and the client keeps its last reading.
const TIMEOUT = 5000;

export async function GET(req: Request) {
  // Proof only: with VEND_DEMO_CLOCK=1 set, ?demoAge=SECONDS pretends the tip block is that old. Off by default.
  const demo = process.env.VEND_DEMO_CLOCK === "1" ? Number(new URL(req.url).searchParams.get("demoAge")) : NaN;
  if (Number.isFinite(demo)) {
    const live = await fetch("https://time.pacsarcade.org/height", { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) }).then((r) => r.json() as Promise<{ height: number }>).catch(() => null);
    return NextResponse.json({ ok: true, height: live?.height ?? 974000, tipTimestamp: Math.floor(Date.now() / 1000) - demo, source: "demo" });
  }
  try {
    const r = await fetch("https://frens.earth/api/chain/tip?full=1", { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    if (r.ok) {
      const j = (await r.json()) as { height?: number | null; tipTimestamp?: number | null };
      if (typeof j.height === "number" && j.height > 0) return NextResponse.json({ ok: true, height: j.height, tipTimestamp: typeof j.tipTimestamp === "number" ? j.tipTimestamp : null, source: "frens.earth" });
    }
  } catch { /* fall through to the time service */ }
  try {
    const r = await fetch("https://time.pacsarcade.org/height", { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    const j = (await r.json()) as { height?: number };
    if (r.ok && typeof j.height === "number") return NextResponse.json({ ok: true, height: j.height, tipTimestamp: null, source: "time.pacsarcade.org" });
  } catch { /* total failure */ }
  return NextResponse.json({ ok: false });
}
