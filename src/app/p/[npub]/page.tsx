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
import { HexAreas, HexMark } from "@/components/Hex";
import { PassportStamps } from "@/components/PassportStamps";
import { passportFor } from "@/lib/passport";

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
  const lightning = (id: string) => !!st.machines.find((m) => m.id === id)?.profile.lightning;
  const firstOwned = s.ownedMachines[0];
  const stamps = firstOwned ? passportFor(st, firstOwned.id, { publicView: true }).events : [];
  const mach = (list: typeof s.ownedMachines) => (
    <ul className="plain mlist">{list.map((m) => (
      <li key={m.id} className="notch notch-sm mrow">
        <HexMark kind={lightning(m.id) ? "coin" : "machine"} size={30} />
        <span><b>{m.name}</b><span className="dim"> {m.status}</span></span>
        <Link className="btn mini-btn" href={`/m/${m.id}`}>Passport</Link>
      </li>
    ))}</ul>
  );
  return (
    <>
      <Nav on="" />
      <main className="page pf">
        <h1>Profile: {roles.length ? roles.join(" and ") : "vend.frens member"}</h1>
        <p className="intro">Works with any nostr account: we read kind 0 and add our own fields beside it.</p>
        <NostrProfile hex={key.hex} npub={key.npub} mine={mine} signedIn={!!me} />
        {mine && (
          <div className="glass card hot">
            <div className="sechd"><h2>Edit: where does the change live?</h2><span className="pill line">Only you see this</span></div>
            <div className="choices">
              <div className="kvtile"><b>Update my nostr profile</b><span>Picture, banner, names, about, verified name, lightning address and website. Your own signer signs the change. It then shows in every nostr app.</span><a className="btn gild mini-btn" href="#nostr">Go to my nostr profile</a></div>
              <div className="kvtile"><b>vend.frens only</b><span>Your line, when you are around, and what you share. Saved on vend.frens. Your nostr profile does not change, and nothing is signed.</span><a className="btn mini-btn" href="#vend">Edit vend.frens fields</a></div>
            </div>
          </div>
        )}
        <div className="glass card">
          <div className="sechd"><h2>Role</h2><span className="pill line">vend.frens only</span></div>
          <div className="kvgrid">
            <div className="kvtile"><span>Role</span><b>{roles.length ? roles.join(" and ") : "None on record"}</b></div>
            {s.onCrew ? <div className="kvtile"><span>On the crew since block</span><b className="num">{s.since?.h ? s.since.h.toLocaleString("en-US") : "Not recorded"}</b></div> : <div className="kvtile"><span>Machines owned</span><b className="num">{s.ownedMachines.length}</b></div>}
            {s.onCrew ? <div className="kvtile"><span>Crew name</span><b>{s.crewName ? `${s.crewName}.vend@frens` : "Not set"}</b></div> : <div className="kvtile"><span>Machines serviced</span><b className="num">{s.servicedMachines.length}</b></div>}
          </div>
          {s.onCrew && s.since && <p className="dim" style={{ marginTop: 10 }}>On the crew since <Bft iso={s.since.date} h={s.since.h} />. Crew jobs: {s.roles.map((r) => ROLE_COPY[r].title).join(", ") || "none yet"}.</p>}
          <p className="dim" style={{ marginTop: 10 }}>A line from them: {s.vend.blurb ? s.vend.blurb.replace(/\.$/, "") : "Not set"}. When they are around: {s.vend.availability || "Not set"}.</p>
          {s.onCrew && <div className="actions"><Link className="btn" href={`/p/${key.npub}/badge`}>Show crew ID badge</Link><Link className="btn" href={`/verify/${key.npub}`}>Verify page</Link></div>}
        </div>
        <div className="glass card">
          <div className="sechd"><h2>Service area</h2><span className="pill line">vend.frens only</span></div>
          {!showArea ? <p className="muted">Not shared.</p> : s.area.length === 0 ? <p className="muted">No places on record yet.</p> : (
            <>
              <HexAreas cells={s.area.map((a) => a.cell)} />
              <p className="dim" style={{ marginTop: 10 }}>{s.area.length} H3 hexagon{s.area.length === 1 ? "" : "s"} (size {AREA_RES}, about 5 square km each). Shown as areas, never as a street address.{mine && !s.vend.showArea ? " Only you see this until you turn on sharing below." : ""}</p>
            </>
          )}
        </div>
        {s.ownedMachines.length > 0 && (
          <div className="glass card">
            <div className="sechd"><h2>Machines</h2><span className="pill line">vend.frens only</span></div>
            {mach(s.ownedMachines)}
          </div>
        )}
        {s.onCrew && showJobs && (
          <div className="glass card">
            <div className="sechd"><h2>Jobs and machines serviced</h2><span className="pill line">Public</span></div>
            <div className="kvgrid"><div className="kvtile"><span>Jobs done</span><b className="num">{s.jobsDone}</b></div><div className="kvtile"><span>Machines serviced</span><b className="num">{s.servicedMachines.length}</b></div></div>
            {s.servicedMachines.length === 0 ? <p className="muted" style={{ marginTop: 10 }}>None yet.</p> : <div style={{ marginTop: 10 }}>{mach(s.servicedMachines)}</div>}
          </div>
        )}
        {firstOwned && (
          <div className="glass card">
            <div className="sechd"><h2>Latest stamps, {firstOwned.name}</h2><span className="pill line">Public</span></div>
            <PassportStamps events={stamps} page={4} cols={2} />
            <div className="actions"><Link className="btn full" href={`/m/${firstOwned.id}`}>Open the machine passport</Link></div>
          </div>
        )}
        {!mine && !s.onCrew && (
          <div className="glass card">
            <div className="sechd"><h2>Join the crew</h2><span className="pill line">Open to all</span></div>
            <p className="dim">Crew are paid in sats per approved job. A badge and a crew name come with the first approved job.</p>
            <div className="actions"><Link className="btn gild full" href="/crew/apply">Ask to join the crew</Link></div>
          </div>
        )}
        {!mine && s.ownedMachines.length === 0 && (
          <div className="glass card">
            <div className="sechd"><h2>Want a machine at your place?</h2><span className="pill line">Open to all</span></div>
            <p className="dim">Hosts give a spot by the door and earn a share of every sale. The crew does the restocking, cleaning and repairs.</p>
            <div className="actions"><Link className="btn gild full" href="/owner/apply">Ask for a machine</Link></div>
          </div>
        )}
        {mine && <div id="vend"><VendEditor initial={s.vend} /></div>}
      </main>
    </>
  );
}
