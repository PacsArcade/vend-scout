import { CrewSwitch } from "@/components/CrewSwitch";
import { WorkHome } from "@/components/WorkHome";
import { stampString } from "@/components/Bft";
import { GIG } from "@/lib/gig";
import { ILLINOIS } from "@/lib/places";
import { doneCount } from "@/lib/offers";
import { nowMs } from "@/lib/clock";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ crew?: string }> }) {
  const { crew } = await searchParams;
  const st = await readState();
  const people = st.applicants.filter((a) => a.stage === "On the crew");
  const me = people.find((a) => a.id === crew);
  const blocks = me ? await Promise.all(st.blocks.filter((b) => b.by === me.id && Date.parse(b.endAt) > nowMs()).map(async (b) => ({ id: b.id, cityName: b.cityName, start: await stampString(b.startAt), end: await stampString(b.endAt) }))) : [];
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>frens.earth · Machines</span><span>crew</span></div>
        <h1>Crew home</h1>
        <CrewSwitch crew={people.map((a) => ({ id: a.id, name: a.name }))} current={me?.id} />
        {!me ? (
          <p className="muted">{people.length === 0 ? "No one is On the crew yet. Once you finish a ride-along and are moved to On the crew, this is your home." : "Pick your name to go online."}</p>
        ) : (
          <WorkHome key={me.id} me={me.id} name={me.name} hasLightning={!!me.lightning} hasArea={me.lat !== undefined} online={!!st.online[me.id]} done={doneCount(st, me.id)} welcomeJobs={GIG.welcomeJobs}
            pin={me.lat !== undefined ? { lat: me.lat, lon: me.lon! } : null} cities={ILLINOIS.map((c) => ({ slug: c.slug, name: c.name }))} blocks={blocks}
            startHours={GIG.startHours} lengthHours={GIG.lengthHours} passLine="Pass anytime. No score, no penalty." center={[41.88, -87.65]} />
        )}
      </div>
    </div>
  );
}
