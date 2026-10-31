import { MyWork, type ClaimView, type RouteView } from "@/components/MyWork";
import { stampString } from "@/components/Bft";
import { locate } from "@/lib/jobs";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RunIndex({ searchParams }: { searchParams: Promise<{ crew?: string }> }) {
  const { crew } = await searchParams;
  const st = await readState();
  const people = st.applicants.filter((a) => a.stage === "On the crew");
  const claims: ClaimView[] = [];
  for (const c of st.claims) {
    const at = await locate(st, c.job);
    claims.push({ job: c.job, by: c.by, title: c.title, sats: c.sats, stamp: await stampString(c.at, c.h), done: !!c.doneAt, doneStamp: c.doneAt ? await stampString(c.doneAt, c.doneH) : undefined, lat: at?.lat, lon: at?.lon, lightning: st.applicants.find((a) => a.id === c.by)?.lightning });
  }
  const routes: RouteView[] = st.routes.filter((r) => r.runner).map((r) => ({ id: r.id, name: r.name, runner: r.runner!, stops: r.stops.length, logged: r.done.length }));
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>frens.earth · Machines</span><span>my work</span></div>
        <h1>My claimed jobs</h1>
        <MyWork crew={people.map((a) => ({ id: a.id, name: a.name }))} claims={claims} routes={routes} initial={crew && people.some((p) => p.id === crew) ? crew : undefined} />
      </div>
    </div>
  );
}
