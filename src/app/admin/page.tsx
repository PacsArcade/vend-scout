import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ActionButton } from "@/components/Actions";
import { CityFilter } from "@/components/CityFilter";
import { ProofReview, type ProofView } from "@/components/ProofReview";
import { stampString } from "@/components/Bft";
import { findProspect } from "@/lib/overpass";
import { openJobs } from "@/lib/jobs";
import { listPlaces } from "@/lib/places";
import { readState } from "@/lib/store";
import { APPLICANT_STAGES, STAGES, type Stage } from "@/lib/types";

export const dynamic = "force-dynamic";

const NEXT: Record<string, Stage | undefined> = { Found: "Visited", Visited: "Pitched", Pitched: "Yes" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city = "" } = await searchParams;
  const st = await readState();
  const day = new Date().toISOString().slice(0, 10);
  const places = await listPlaces();
  const slugOf = new Map<string, string>();
  const nameOf = new Map<string, string>();
  for (const id of new Set([...Object.keys(st.tracked), ...Object.keys(st.packages), ...st.machines.map((m) => m.prospectId).filter(Boolean)])) {
    const h = await findProspect(id);
    if (h) { slugOf.set(id, h.prospect.placeSlug); nameOf.set(id, h.prospect.name); }
  }
  const inCity = (pid: string) => !city || slugOf.get(pid) === city;
  const { jobs, bundles } = await openJobs(st);
  const doneToday = st.claims.filter((c) => c.doneAt?.slice(0, 10) === day);
  const stopsToday = doneToday.length + st.routes.reduce((a, r) => a + r.done.filter((d) => d.at.slice(0, 10) === day).length, 0);
  const paidToday = st.payouts.filter((p) => p.at.slice(0, 10) === day).reduce((a, p) => a + p.sats, 0);
  const newApplicants = st.applicants.filter((a) => a.createdAt === day).length;
  const waiting = st.listings.filter((l) => l.status === "pending" && (!city || slugOf.get(st.machines.find((m) => m.id === l.machine)?.prospectId ?? "") === city));
  const claimedOpen = st.claims.filter((c) => !c.doneAt);
  const toCheck = st.proofs.filter((x) => x.status === "sent");
  const proofViews: ProofView[] = await Promise.all(toCheck.map(async (x) => ({ id: x.id, title: st.claims.find((c) => c.job === x.ref)?.title ?? `Stop on ${st.routes.find((r) => r.id === x.route)?.name ?? "a route"}`, who: st.applicants.find((a) => a.id === x.by)?.name ?? x.by, before: x.before, after: x.after, ticked: x.ticked, loadTotal: x.loadTotal, sentStamp: await stampString(x.history[x.history.length - 1]?.at, x.history[x.history.length - 1]?.h), resent: x.history.some((e) => e.status === "retake") })));
  const who = (id: string) => st.applicants.find((a) => a.id === id)?.name ?? id;
  const strip: [string, string][] = [
    ["Jobs open", String(jobs.length + bundles.length)], ["Proof to check", String(toCheck.length)], ["Stops done today", String(stopsToday)], ["Sats paid out (test)", paidToday.toLocaleString("en-US")],
    ["New applicants", String(newApplicants)], ["Shelf items waiting", String(st.listings.filter((l) => l.status === "pending").length)],
  ];
  return (
    <>
      <Nav on="admin" />
      <main className="page wide-page">
        <h1>Admin</h1>
        <div className="strip strip5">{strip.map(([k, v]) => <div key={k} className="glass kpi"><span className="muted">{k}</span><div className="v num">{v}</div></div>)}</div>
        <CityFilter cities={places.map((p) => ({ slug: p.slug, name: p.name }))} current={city} />
        <div className="admboard">
          <section className="glass card">
            <h2>Places</h2>
            <div className="admrow">
              {STAGES.map((s) => {
                const ids = Object.entries(st.tracked).filter(([id, stg]) => stg === s && inCity(id)).map(([id]) => id);
                return (
                  <div key={s} className="admcol"><h3><span>{s}</span><span className="muted num">{ids.length}</span></h3>
                    {ids.map((id) => (
                      <div key={id} className="glass admcard"><Link href={`/prospects/${id}`}>{nameOf.get(id) ?? id}</Link>
                        {NEXT[s] && <ActionButton label={`Next step: ${NEXT[s]}`} payload={{ action: "stage", id, stage: NEXT[s] }} />}
                        {s === "Yes" && <Link className="btn" href={`/admin/place/${id}`}>Next step: pick a machine</Link>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="glass card">
            <h2>Sites</h2>
            <div className="admrow">
              {(["drafted", "offered", "accepted"] as const).map((s) => {
                const ids = Object.entries(st.packages).filter(([id, p]) => p.status === s && inCity(id)).map(([id]) => id);
                return (
                  <div key={s} className="admcol"><h3><span>{s[0].toUpperCase() + s.slice(1)}</span><span className="muted num">{ids.length}</span></h3>
                    {ids.map((id) => (
                      <div key={id} className="glass admcard"><Link href={`/prospects/${id}/site`}>{nameOf.get(id) ?? id}</Link>
                        {s !== "accepted" && <ActionButton label="Next step" payload={{ action: "advance", kind: "site", id }} />}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="glass card">
            <h2>Machines</h2>
            <div className="admrow">
              {(["In storage", "Placed", "In repair"] as const).map((s) => {
                const ms = st.machines.filter((m) => m.status === s && (s === "Placed" ? inCity(m.prospectId) : true));
                return (
                  <div key={s} className="admcol"><h3><span>{s}</span><span className="muted num">{ms.length}</span></h3>
                    {ms.map((m) => (
                      <div key={m.id} className="glass admcard"><Link href={`/machines/${m.id}`}>{m.name}</Link>
                        {s === "In storage" && <Link className="btn" href="/machines/new">Place it</Link>}
                        {s === "Placed" && <ActionButton label={m.restockRequested ? "Restock job is open" : "Make a restock job"} gild={!m.restockRequested} payload={{ action: "restockJob", machine: m.id }} />}
                        {s === "Placed" && <ActionButton label="Mark in repair" className="small2" payload={{ action: "machineStatus", machine: m.id, status: "In repair" }} />}
                        {s === "In repair" && m.prospectId && <ActionButton label="Back in service" gild payload={{ action: "backInService", machine: m.id }} />}
                        {s === "In repair" && !m.prospectId && <ActionButton label="Back to storage" payload={{ action: "machineStatus", machine: m.id, status: "In storage" }} />}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="glass card">
            <h2>Shelf</h2>
            <div className="admrow">
              <div className="admcol"><h3><span>Waiting for host</span><span className="muted num">{waiting.length}</span></h3>
                {waiting.map((l) => (
                  <div key={l.id} className="glass admcard"><Link href={`/shelf/${l.id}`}>{l.item}</Link>
                    <ActionButton label="Next step: approve" payload={{ action: "decide", id: l.id, status: "approved" }} />
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="glass card">
            <h2>Crew</h2>
            <div className="admrow">
              {APPLICANT_STAGES.filter((s) => s !== "Not now").map((s) => {
                const as = st.applicants.filter((a) => a.stage === s);
                return (
                  <div key={s} className="admcol"><h3><span>{s}</span><span className="muted num">{as.length}</span></h3>
                    {as.map((a) => (
                      <div key={a.id} className="glass admcard"><Link href="/crew/applicants">{a.name}</Link><span className="muted">{a.area}</span>
                        {s !== "On the crew" && <ActionButton label="Next step" payload={{ action: "advance", kind: "applicant", id: a.id }} />}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="glass card">
            <h2>Jobs</h2>
            <div className="admrow">
              <div className="admcol"><h3><span>Proof to check</span><span className="muted num">{toCheck.length}</span></h3>
                {proofViews.map((v) => <ProofReview key={v.id} p={v} />)}
              </div>
              <div className="admcol"><h3><span>Open</span><span className="muted num">{jobs.length + bundles.length}</span></h3>
                {[...bundles.map((b) => ({ id: b.route, t: `Route: ${b.name}` })), ...jobs.map((j) => ({ id: j.id, t: j.title }))].slice(0, 8).map((j) => <div key={j.id} className="glass admcard"><Link href="/jobs">{j.t}</Link></div>)}
              </div>
              <div className="admcol"><h3><span>Claimed</span><span className="muted num">{claimedOpen.length}</span></h3>
                {claimedOpen.slice(0, 8).map((c) => <div key={c.job} className="glass admcard"><Link href={`/run?crew=${c.by}`}>{c.title}</Link><span className="muted">{who(c.by)}</span></div>)}
              </div>
              <div className="admcol"><h3><span>Done today</span><span className="muted num">{doneToday.length}</span></h3>
                {doneToday.slice(0, 8).map((c) => <div key={c.job} className="glass admcard"><Link href={`/run?crew=${c.by}`}>{c.title}</Link><span className="muted">{who(c.by)}</span></div>)}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
