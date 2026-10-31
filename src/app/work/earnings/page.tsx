import { CrewSwitch } from "@/components/CrewSwitch";
import { stampString } from "@/components/Bft";
import { nowMs } from "@/lib/clock";
import { readState } from "@/lib/store";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Earnings({ searchParams }: { searchParams: Promise<{ crew?: string }> }) {
  const { crew } = await searchParams;
  const st = await readState();
  const people = st.applicants.filter((a) => a.stage === "On the crew");
  const me = people.find((a) => a.id === crew);
  const mine = me ? st.payouts.filter((p) => p.by === me.id).sort((a, b) => b.at.localeCompare(a.at)) : [];
  const day = new Date(nowMs()).toISOString().slice(0, 10), weekAgo = nowMs() - 7 * 86400_000;
  const sum = (xs: typeof mine) => xs.reduce((a, p) => a + p.sats, 0);
  const rows = await Promise.all(mine.slice(0, 30).map(async (p) => ({ ...p, stamp: await stampString(p.at, p.h) })));
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>frens.earth · Machines</span><span>earnings</span></div>
        <h1>My earnings</h1>
        <CrewSwitch crew={people.map((a) => ({ id: a.id, name: a.name }))} current={me?.id} />
        {!me ? <p className="muted">Pick your name.</p> : (
          <>
            <div className="strip">
              <div className="glass kpi"><span className="muted">Today</span><div className="v">{sum(mine.filter((p) => p.at.slice(0, 10) === day)).toLocaleString("en-US")} sats</div></div>
              <div className="glass kpi"><span className="muted">This week</span><div className="v">{sum(mine.filter((p) => Date.parse(p.at) >= weekAgo)).toLocaleString("en-US")} sats</div></div>
            </div>
            <h2 style={{ marginTop: 16 }}>Per job</h2>
            {rows.length === 0 ? <p className="muted">Nothing yet. Finish a job and it shows here.</p> : rows.map((p, i) => (
              <div key={i} className="step"><span className="n">+</span><div>{p.reason}<br /><span className="num">{p.sats.toLocaleString("en-US")} sats</span><br /><span className="muted small mono">{p.stamp}</span></div></div>
            ))}
            <p className="muted small">Test mode. Nothing is really sent yet. Paid after every job to your Lightning address.</p>
            <div className="actions"><Link className="btn full" href={`/work?crew=${me.id}`}>Back to crew home</Link></div>
          </>
        )}
      </div>
    </div>
  );
}
