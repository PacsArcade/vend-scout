import { notFound } from "next/navigation";
import { BitcoinMark } from "@/components/BitcoinMark";
import { headers } from "next/headers";
import { stampString } from "@/components/Bft";
import { NeighborPanel } from "@/components/NeighborPanel";
import { PassportStamps } from "@/components/PassportStamps";
import { HexZone } from "@/components/Hex";
import { Bft } from "@/components/Bft";
import { visitStamps } from "@/lib/stamps";
import { passportFor } from "@/lib/passport";
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
  const pass = passportFor(st, machine, { publicView: true });
  const visits = visitStamps(pass.events).length;
  return (
    <div className="phonewrap mpwrap">
      <div className="mp">
        <div className="phone mp-left">
          <PhoneBar right="neighbors" />
          <div className="glass card">
            <div className="sechd"><h1 style={{ margin: 0 }}>{m.name}</h1><span className="pill good">{m.status}</span></div>
            <BitcoinMark on={m.profile.lightning} />
            <p className="muted small">At {m.hostName}. <span className="mono">{machineTag(m.id)}</span></p>
            <div className="zonebox" style={{ marginTop: 12 }}>
              <HexZone lat={m.lat} lon={m.lon} coin={m.profile.lightning} />
              <p className="dim">The dashed hexagons are the check-in zone around this machine: its own hexagon and two rings, 19 in all. Shown here, not checked: the app does not read a visitor&apos;s location.</p>
            </div>
            <div className="kvgrid" style={{ marginTop: 12 }}>
              <div className="kvtile"><span>Placed at block</span><b className="num">{m.h ? m.h.toLocaleString("en-US") : "Not set"}</b></div>
              <div className="kvtile"><span>Service visits</span><b className="num">{visits}</b></div>
              <div className="kvtile"><span>Checks</span><b className="num">{pass.counts.verifies}</b></div>
            </div>
          </div>
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
        <div className="mp-right">
          <div className="glass card">
            <div className="sechd"><h2>Machine passport</h2>{visits > 0 && <span className="pill line num">{visits} service visit{visits === 1 ? "" : "s"}</span>}</div>
            <p className="dim" style={{ marginBottom: 12 }}>Every service visit leaves a stamp: what was done, and the block it was approved in. The time is Bitcoin Federated Time, read from the block height.</p>
            <PassportStamps events={pass.events} />
          </div>
          <div className="glass card hot" style={{ marginTop: 14 }}>
            <div className="sechd"><h2>Stamp rarity</h2></div>
            <div className="choices">
              <div className="kvtile"><b>Milestones</b><span>A gold stamp at set counts: visit 1, 21, 100 and 1,000. Everyone can see what is coming.</span></div>
              <div className="kvtile"><b>On-time streaks</b><span>A stamp turns bronze after 3 on-time visits in a row, silver after 7, gold after 21. A late visit starts the count again.</span></div>
            </div>
          </div>
          <div className="glass card" style={{ marginTop: 14 }}>
            <div className="sechd"><h2>Recent record</h2></div>
            <ul className="plain">{pass.events.slice(-6).reverse().map((e, i) => <li key={i}><Bft iso={e.at} h={e.h} /> {e.text}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
