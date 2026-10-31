import { PhoneBar } from "@/components/PhoneBar";
import { notFound } from "next/navigation";
import { HostForm } from "@/components/HostForm";
import { findProspect } from "@/lib/overpass";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HostPage({ params }: { params: Promise<{ prospect: string }> }) {
  const { prospect } = await params;
  const hit = await findProspect(prospect);
  if (!hit) notFound();
  const st = await readState();
  const available: Record<string, number> = {};
  for (const m of st.machines.filter((x) => x.status === "In storage")) available[m.type] = (available[m.type] ?? 0) + 1;
  const prev = st.hostPicks[prospect];
  return (
    <div className="phonewrap">
      <div className="phone hostphone">
        <PhoneBar right="for hosts" />
        <h1>Which machine would you like at {hit.prospect.name}?</h1>
        <p className="muted small">We place, stock and clean it. You get a share of every sale. Tap the kinds you would like. No account needed.</p>
        <HostForm prospectId={prospect} available={available} initial={prev ? { types: prev.types, other: prev.other, note: prev.note } : undefined} />
        <p className="muted small">A Pac&apos;s Arcade project at frens.earth.</p>
      </div>
    </div>
  );
}
