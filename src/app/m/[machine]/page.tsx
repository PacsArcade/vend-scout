import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { stampString } from "@/components/Bft";
import { NeighborPanel } from "@/components/NeighborPanel";
import { PhoneBar } from "@/components/PhoneBar";
import { boardName } from "@/lib/arcade";
import { npubToHex } from "@/lib/operator";
import { latestProof, machineTag } from "@/lib/social";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

// The page a neighbor reaches from the QR on the machine. Public: it shows the newest stocking photo and lets a signed-in neighbor verify, report, request items, tip and share.
export default async function NeighborPage({ params }: { params: Promise<{ machine: string }> }) {
  const { machine } = await params;
  const st = await readState();
  const m = st.machines.find((x) => x.id === machine);
  if (!m || m.status !== "Placed") notFound();
  const p = latestProof(st, machine);
  const runner = p ? st.applicants.find((a) => a.id === p.by) : undefined;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const origin = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
  const stamp = p ? await stampString(p.sentAt, p.history[p.history.length - 1]?.h) : "";
  const verifies = p ? st.verifies.filter((v) => v.proof === p.id).length : 0;
  return (
    <div className="phonewrap">
      <div className="phone">
        <PhoneBar right="neighbors" />
        <h1>{m.name}</h1>
        <p className="muted small">At {m.hostName}. <span className="mono">{machineTag(m.id)}</span></p>
        {p ? (
          <div className="glass tile">
            <div className="muted small">Filled {p.status === "approved" ? "and checked" : "and waiting for a check"}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="neighborphoto" src={`/api/m/${m.id}/photo`} alt={`The newest stocking photo of ${m.name}`} />
            <p className="small">After photo, <span className="mono">{stamp}</span>{runner ? <>, by {boardName(runner.name)}</> : null}</p>
          </div>
        ) : <div className="glass tile"><b>No stocking photo yet</b><p className="muted small">When the stocker sends one, it shows here.</p></div>}
        <NeighborPanel machine={m.id} machineName={m.name} tag={machineTag(m.id)} origin={origin} hasPhoto={!!p} stocker={runner ? boardName(runner.name) : "The stocker"} tipOk={!!runner?.lightning} runnerHex={runner?.npub ? npubToHex(runner.npub) : null} verifies={verifies} />
        <p className="muted small">Credits are for use at our machines. They are not money.</p>
      </div>
    </div>
  );
}
