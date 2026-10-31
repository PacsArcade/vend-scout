import { PhoneBar } from "@/components/PhoneBar";
import { PointsPanel } from "@/components/PointsPanel";
import { PopHost } from "@/components/PopHost";
import { badgesFor, levelOf, streakDays, totalPoints } from "@/lib/arcade";
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
  const total = me ? totalPoints(st.proofs, me.id) : 0;
  const lv = levelOf(total);
  const day = new Date(nowMs()).toISOString().slice(0, 10);
  const streak = me ? streakDays(st.proofs.filter((p) => p.by === me.id && p.status === "approved" && p.approvedAt).map((p) => p.approvedAt!.slice(0, 10)), day) : 0;
  const pops = st.proofs.filter((p) => p.status === "approved" && !p.popSeen).map((p) => ({ id: p.id, by: p.by, title: "", points: p.points ?? 0, sats: p.paidSats ?? 0, breakdown: p.breakdown ?? [] }));
  return (
    <div className="phonewrap">
      <div className="phone">
        <PhoneBar right="crew" />
        <h1>Crew home</h1>
        <CrewSwitch crew={people.map((a) => ({ id: a.id, name: a.name }))} current={me?.id} />
        {!me ? (
          <p className="muted">{people.length === 0 ? "No one is On the crew yet. Once you finish a ride-along and are moved to On the crew, this is your home." : "Pick your name to go online."}</p>
        ) : (
          <>
            <PopHost pops={pops} me={me.id} />
            <PointsPanel me={me.id} total={total} level={lv.level} name={lv.name} next={lv.next} nextName={lv.nextName} pct={lv.pctToNext} badges={badgesFor(st.proofs, me.id)} streak={streak} board={!!me.leaderboard} />
          <WorkHome key={me.id} me={me.id} name={me.name} hasLightning={!!me.lightning} hasArea={me.lat !== undefined} online={!!st.online[me.id]} done={doneCount(st, me.id)} welcomeJobs={GIG.welcomeJobs}
            pin={me.lat !== undefined ? { lat: me.lat, lon: me.lon! } : null} cities={ILLINOIS.map((c) => ({ slug: c.slug, name: c.name }))} blocks={blocks}
            startHours={GIG.startHours} lengthHours={GIG.lengthHours} passLine="Pass anytime. No score, no penalty." center={[41.88, -87.65]} />
          </>
        )}
      </div>
    </div>
  );
}
