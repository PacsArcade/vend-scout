import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { NostrProfile } from "@/components/NostrProfile";
import { VendEditor } from "@/components/VendEditor";
import { readState } from "@/lib/store";
import { keyFromParam, summaryFor } from "@/lib/vendprofile";
import { sessionKeyFromCookies } from "@/lib/profilesession";
import { ROLE_COPY } from "@/lib/crew";
import { AREA_RES } from "@/lib/areas";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ npub: string }> }) {
  const key = keyFromParam((await params).npub);
  if (!key) notFound();
  const st = await readState();
  const s = summaryFor(st, key.hex);
  const me = sessionKeyFromCookies((await headers()).get("cookie"));
  const mine = me === key.hex;
  const showJobs = mine || s.vend.showJobs;
  const showArea = mine || s.vend.showArea;
  const roles = [...(s.onCrew ? ["Servicer"] : []), ...(s.ownedMachines.length > 0 ? ["Owner"] : [])];
  return (
    <>
      <Nav on="" />
      <main className="page narrow">
        <h1>Profile</h1>
        <p className="mono small" style={{ overflowWrap: "anywhere" }}>{key.npub}</p>
        <NostrProfile hex={key.hex} mine={mine} signedIn={!!me} />
        <div className="glass card">
          <h2>On vend.frens</h2>
          <table><tbody>
            <tr><td className="muted small">Role</td><td>{roles.length ? roles.join(" and ") : <span className="muted">None on record</span>}</td></tr>
            {s.onCrew && <>
              <tr><td className="muted small">Crew name</td><td>{s.crewName ? `${s.crewName}.vend@frens` : <span className="muted">Not set</span>}</td></tr>
              <tr><td className="muted small">Crew jobs</td><td>{s.roles.map((r) => ROLE_COPY[r].title).join(", ") || <span className="muted">None</span>}</td></tr>
              <tr><td className="muted small">On the crew since</td><td>{s.since ? <Bft iso={s.since.date} h={s.since.h} /> : <span className="muted">Not recorded</span>}</td></tr>
              {showJobs && <tr><td className="muted small">Jobs done</td><td className="num">{s.jobsDone}</td></tr>}
            </>}
            <tr><td className="muted small">A line from them</td><td>{s.vend.blurb || <span className="muted">Not set</span>}</td></tr>
            <tr><td className="muted small">When they are around</td><td>{s.vend.availability || <span className="muted">Not set</span>}</td></tr>
          </tbody></table>
          {s.onCrew && <div className="actions"><Link className="btn" href={`/p/${key.npub}/badge`}>Crew ID badge</Link><Link className="btn" href={`/verify/${key.npub}`}>Verify page</Link></div>}
        </div>
        <div className="glass card">
          <h2>Machines they own</h2>
          {s.ownedMachines.length === 0 ? <p className="muted">None on record.</p> : <ul className="plain">{s.ownedMachines.map((m) => <li key={m.id}>{m.name} <span className="muted small">{m.status}</span></li>)}</ul>}
        </div>
        {s.onCrew && showJobs && (
          <div className="glass card">
            <h2>Machines they service</h2>
            {s.servicedMachines.length === 0 ? <p className="muted">None yet.</p> : <ul className="plain">{s.servicedMachines.map((m) => <li key={m.id}>{m.name} <span className="muted small">{m.status}</span></li>)}</ul>}
          </div>
        )}
        <div className="glass card">
          <h2>Service area</h2>
          {!showArea ? <p className="muted">Not shared.</p> : s.area.length === 0 ? <p className="muted">No places on record yet.</p> : (
            <>
              <table><thead><tr><th>Area (H3 cell)</th><th className="r">Machines</th><th className="r">Jobs</th></tr></thead>
                <tbody>{s.area.map((a) => <tr key={a.cell}><td><span className="mono small">{a.cell}</span><div className="muted small">near {a.lat}, {a.lon}</div></td><td className="r num">{a.machines}</td><td className="r num">{a.jobs}</td></tr>)}</tbody></table>
              <p className="muted small">Each cell is about 5 square km (H3 size {AREA_RES}), a neighborhood. Never an address.{mine && !s.vend.showArea ? " Only you see this until you turn on sharing below." : ""}</p>
            </>
          )}
        </div>
        {mine && <VendEditor initial={s.vend} />}
      </main>
    </>
  );
}
