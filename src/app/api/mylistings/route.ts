import { NextResponse } from "next/server";
import { validLightning } from "@/lib/lightning";
import { readState } from "@/lib/store";

// GET ?ln=you@wallet.example returns the listings made with that Lightning address. No account.
export async function GET(req: Request) {
  const v = validLightning(new URL(req.url).searchParams.get("ln") ?? "");
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const st = await readState();
  const items = st.listings.filter((l) => l.lightning === v.value).map((l) => ({ id: l.id, item: l.item, status: l.status, priceSats: l.priceSats, qty: l.qty, machine: st.machines.find((m) => m.id === l.machine)?.name ?? "a machine" }));
  return NextResponse.json({ ok: true, items });
}
