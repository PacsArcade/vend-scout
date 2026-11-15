import { PhoneBar } from "@/components/PhoneBar";
import { notFound } from "next/navigation";
import { VoteClient } from "@/components/VoteClient";
import { getVotes, readState } from "@/lib/store";
import { VOTE_PROMISE } from "@/lib/vote";

export const dynamic = "force-dynamic";

export default async function VotePage({ params }: { params: Promise<{ machine: string }> }) {
  const { machine } = await params;
  const m = (await readState()).machines.find((x) => x.id === machine);
  if (!m || m.status !== "Placed") notFound();
  const rows = await getVotes(machine);
  return (
    <div className="phonewrap">
      <div className="phone">
        <PhoneBar right="vote for this machine" />
        <h1>What should go in here?</h1>
        <p className="muted small">{m.name}. {VOTE_PROMISE}</p>
        <VoteClient machine={machine} rows={rows} />
        {/* r24: the sats-backed vote stays hidden until a real Lightning payment sits behind it. Every vote counts 1. */}
        <p className="muted small">One vote each time you tap. Anyone can vote, no sign-in.</p>
      </div>
    </div>
  );
}
