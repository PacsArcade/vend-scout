import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { RouteBuilder, type MachineOpt } from "@/components/RouteBuilder";
import { RunnerSelect } from "@/components/RunnerSelect";
import { Empty } from "@/components/Shell";
import { getVotes, readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const st = await readState();
  const runners = st.applicants.filter((a) => a.stage === "On the crew").map((a) => ({ id: a.id, name: a.name }));
  const machines: MachineOpt[] = [];
  for (const m of st.machines) {
    if (m.lat === undefined || m.status !== "Placed") continue;
    const low = m.slots.filter((s) => s.kind !== "pickup" && s.level < 0.45).length;
    machines.push({ id: m.id, name: m.name, host: m.hostName, lat: m.lat, lon: m.lon!, low, topVote: (await getVotes(m.id))[0]?.name });
  }
  const mname = (id: string) => st.machines.find((m) => m.id === id)?.name ?? id;
  const logged = new Map<string, number>();
  for (const r of st.routes) if (r.runner) logged.set(r.runner, (logged.get(r.runner) ?? 0) + r.done.length);
  const center: [number, number] = machines[0] ? [machines[0].lat, machines[0].lon] : [41.88, -87.65];
  return (
    <>
      <Nav on="routes" />
      <main className="page">
        <h1>Routes</h1>
        <p className="muted measure">A route is an ordered list of placed machines for one runner. Pay per stop waits on the pay terms, so this page only counts stops logged.</p>
        {machines.length === 0 && <Empty title="No machines placed yet"><p className="muted">A route needs placed machines. Place one at a prospect first.</p><div className="actions"><Link className="btn gild" href="/machines/new">Place a machine</Link></div></Empty>}
        <RouteBuilder machines={machines} runners={runners} center={center} />
        {runners.length === 0 && st.machines.length > 0 && <p className="muted small">No one is On the crew yet, so routes stay unassigned. Move an applicant to On the crew on the <Link href="/crew/applicants">applicants page</Link>.</p>}
        {st.routes.length > 0 && (
          <div className="cards">
            {await Promise.all(st.routes.map(async (r) => (
              <div key={r.id} className="glass card item">
                <h2>{r.name}</h2>
                <RunnerSelect route={r.id} runner={r.runner} runners={runners} />
                <ol className="stoplist" style={{ width: "100%" }}>
                  {r.stops.map((id, i) => {
                    const d = r.done.find((x) => x.machine === id);
                    return <li key={id}><span className="n">{i + 1}</span><span className="grow">{mname(id)}{d && <><br /><span className="muted small"><Bft iso={d.at} h={d.h} /></span></>}</span><span className="chip">{d ? "done" : "to do"}</span>{d?.photo && <a className="chip" href={`/api/stopphoto/${d.photo}`} target="_blank" rel="noopener noreferrer">photo</a>}</li>;
                  })}
                </ol>
                <p className="num">Stops logged: {r.done.length} of {r.stops.length}</p>
                <div className="actions"><Link className="btn gild" href={`/run/${r.id}`}>Open the runner view</Link></div>
              </div>
            )))}
          </div>
        )}
        {logged.size > 0 && (
          <div className="glass card">
            <h2>Stops logged per runner</h2>
            <table><tbody>{[...logged].map(([id, n]) => <tr key={id}><td>{st.applicants.find((a) => a.id === id)?.name}</td><td className="r num">{n}</td></tr>)}</tbody></table>
          </div>
        )}
      </main>
    </>
  );
}
