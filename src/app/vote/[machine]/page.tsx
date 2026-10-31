import { notFound } from "next/navigation";
import { VoteClient } from "@/components/VoteClient";
import { getVotes, readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function VotePage({ params }: { params: Promise<{ machine: string }> }) {
  const { machine } = await params;
  const m = (await readState()).machines.find((x) => x.id === machine);
  if (!m) notFound();
  const rows = await getVotes(machine);
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>frens.earth · Machines</span><span>scanned from the machine</span></div>
        <h1>What should go in here?</h1>
        <p className="muted small">{m.name}. Top picks go in on the next restock.</p>
        <VoteClient machine={machine} rows={rows} />
        <p className="muted small">Got a Lightning wallet? Back your vote with sats and it counts double.</p>
      </div>
    </div>
  );
}
