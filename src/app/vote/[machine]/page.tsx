import { notFound } from "next/navigation";
import { VoteClient } from "@/components/VoteClient";
import { getMachine, getVotes } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function VotePage({ params }: { params: Promise<{ machine: string }> }) {
  const { machine } = await params;
  const m = getMachine(machine);
  if (!m) notFound();
  const rows = await getVotes(machine);
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>Vend Scout</span><span>scanned from the machine</span></div>
        <h1>What should go in here?</h1>
        <p className="muted small" style={{ marginBottom: 10 }}>{m.name}. Top picks go in on the next restock.</p>
        <VoteClient machine={machine} machineName="" initial={rows} />
      </div>
    </div>
  );
}
