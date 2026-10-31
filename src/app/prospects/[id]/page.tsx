import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { ScoutCheckForm } from "@/components/ScoutCheckForm";
import { ContactsPanel } from "@/components/ContactsPanel";
import { ActionForm } from "@/components/Actions";
import { ProspectActions } from "@/components/ProspectActions";
import { findProspect } from "@/lib/overpass";
import { normalizeUrl, osmContacts, readCached } from "@/lib/contacts";
import { checksWithStamps } from "@/lib/scoutcheck";
import { readState } from "@/lib/store";
import { typeLabel } from "@/lib/machineTypes";
import { openLateValue } from "@/lib/score";
import { INSIDE_LABEL, STAGES, CATEGORY_LABEL, OUTREACH_HOW, OUTREACH_OUTCOME } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const st = await readState();
  const checks = await checksWithStamps(st);
  const hit = await findProspect(id, checks);
  if (!hit) notFound();
  const { prospect: p, scored } = hit;
  const stage = st.tracked[id] ?? null;
  const notes = st.notes[id] ?? [];
  const pkg = st.packages[id];
  const at = stage ? STAGES.indexOf(stage) : -1;
  const siteUrl = normalizeUrl(p.tags.website ?? "");
  const cached = siteUrl ? await readCached(siteUrl) : null;
  const machine = st.machines.find((m) => m.prospectId === id);
  const check = st.checks[id];
  const log = st.outreach[id] ?? [];
  return (
    <>
      <Nav on="prospects" />
      <div className="two">
        <div className="col">
          <div className="glass card">
            <div className="headrow">
              <div className="score">{scored.score}</div>
              <div>
                <h1>{p.name}</h1>
                <div className="muted">{CATEGORY_LABEL[p.category]} · {p.area} · {openLateValue(p.openingHours).note.toLowerCase()}</div>
              </div>
            </div>
            <div className="pipe">
              {STAGES.map((s, i) => <span key={s} className={i < at ? "done" : i === at ? "now" : ""}>{s}</span>)}
            </div>
            {stage === null && <p className="muted small">Not tracked yet. Press Track this place to start the stage track.</p>}
            {machine && <p className="small">Machine here: <Link href={`/machines/${machine.id}`}>{machine.name}</Link></p>}
            <h2>Why it scores {scored.score}</h2>
            <div className="bars">
              {scored.factors.map((f) => (
                <div key={f.key}>
                  <span>{f.label}<br /><span className="muted small">{f.note}</span></span>
                  <span className="bar"><i style={{ width: `${f.value}%` }} /></span>
                  <span className="num">{f.value}</span>
                </div>
              ))}
            </div>
            <p className="muted small">Each bar is a 0 to 100 reading, weighted: {scored.factors.map((f) => `${f.label} ${Math.round(f.weight * 100)}%`).join(", ")}. Source: OpenStreetMap, {p.lat.toFixed(4)}, {p.lon.toFixed(4)}.</p>
            <h2 style={{ marginTop: 18 }}>Notes</h2>
            <div className="log">
              {notes.length === 0 && <div className="muted">No notes yet.</div>}
              {await Promise.all(notes.map(async (n, i) => <div key={i}><Bft iso={n.date} h={n.h} /> · {n.text}</div>))}
            </div>
          </div>
          <div className="glass card">
            <h2>Already inside</h2>
            {cached?.mentionsVending && <p className="small"><span className="chip">Mentions vending on their site</span> A hint only. It does not change the score. Look when you visit.</p>}
            {check ? <p className="small">Last scout check <Bft iso={check.at} h={check.h} />: {INSIDE_LABEL[check.inside]}{check.who ? `, run by ${check.who}` : ""}{check.state ? `, ${check.state.toLowerCase()}` : ""}, room for another: {check.room}.</p> : <p className="muted small">Not checked yet. Look inside on your visit and fill this in. It replaces the map guess in the score.</p>}
            <ScoutCheckForm id={id} initial={check ? { inside: check.inside, who: check.who, state: check.state, room: check.room } : undefined} crew={st.applicants.filter((a) => a.stage === "On the crew").map((a) => ({ id: a.id, name: a.name }))} />
          </div>
          <ContactsPanel id={id} osm={osmContacts(p.tags)} site={cached?.contacts ?? []} siteUrl={siteUrl} note={cached?.note} hasSite={!!siteUrl} />
          {st.hostPicks[id] && (
            <div className="glass card">
              <h2>What the host would like</h2>
              <p>{[...st.hostPicks[id].types.map((t) => typeLabel(t)), st.hostPicks[id].other].filter(Boolean).join(", ")}</p>
              {st.hostPicks[id].note && <p className="muted small">{st.hostPicks[id].note}</p>}
              <p className="muted small"><Bft iso={st.hostPicks[id].date} h={st.hostPicks[id].h} /></p>
            </div>
          )}
          <div className="glass card">
            <h2>Outreach log</h2>
            {log.length === 0 ? <p className="muted">No contact yet. Log each email, call, visit or message here.</p> : (
              <table><tbody>
                {await Promise.all([...log].reverse().map(async (o, i) => (
                  <tr key={i}><td className="muted small"><Bft iso={o.date} h={o.h} /></td><td>{o.how} with {o.who}<br /><span className="muted small">{o.outcome}{o.note ? ` · ${o.note}` : ""}</span></td></tr>
                )))}
              </tbody></table>
            )}
            <ActionForm action="outreach" extra={{ id }} submit="Log contact" doneText="Logged." fields={[
              { name: "who", label: "Who", placeholder: "Name or role" },
              { name: "how", label: "How", type: "select", value: "call", options: OUTREACH_HOW.map((h) => ({ value: h, label: h })) },
              { name: "outcome", label: "Outcome", type: "select", value: "Talked", options: OUTREACH_OUTCOME.map((h) => ({ value: h, label: h })) },
              { name: "note", label: "Note", optional: true, placeholder: "What was said" },
            ]} />
          </div>
          {!siteUrl && (
            <div className="glass card">
              <h2>No website</h2>
              <p className="muted">This place has no website on the map. We can build them a one-page site as part of the machine package.</p>
              {pkg && <p className="small">Package status: <b>{pkg.status}</b></p>}
              <div className="actions"><Link className="btn gild" href={`/prospects/${id}/site`}>{pkg ? "Open their site package" : "Build them a site"}</Link></div>
            </div>
          )}
        </div>
        <div>
          <div className="sheet">
            <h3>A snack machine for {p.name}, at no cost to you</h3>
            <div className="askbox"><b>First question: do you have machines now, and who runs them?</b><div className="askline" /><div className="askline" /></div>
            <p>We place, stock and clean it. You get a share of every sale, paid monthly in bitcoin.</p>
            <div className="row"><span>Your share</span><b>10% of sales</b></div>
            <div className="row"><span>Space it needs</span><b>3 ft wide, one outlet</b></div>
            <div className="row"><span>Restock</span><b>Twice a week, before 8 AM</b></div>
            <div className="row"><span>Payment</span><b>Bitcoin, priced in sats</b></div>
            <div className="row"><span>Your customers pick</span><b>They vote what goes in it</b></div>
            <div className="row"><span>Choose your machine at</span><b>/host/{id}</b></div>
            <div className="row"><span>Local makers</span><b>Neighbours can sell on your shelf</b></div>
            {!siteUrl && <div className="row"><span>A site for you</span><b>One page, part of the package</b></div>}
            <p className="small">Pac&apos;s Arcade, at frens.earth · (phone) · leave any time with 30 days&apos; notice</p>
          </div>
          <p className="muted small noprint">The host link to share: <Link href={`/host/${id}`}>/host/{id}</Link></p>
          <ProspectActions id={id} stage={stage} />
        </div>
      </div>
    </>
  );
}
