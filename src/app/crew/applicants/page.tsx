import { Nav } from "@/components/Nav";
import { ApplicantsBoard, type ApplicantView } from "@/components/ApplicantsBoard";
import { stampString } from "@/components/Bft";
import { readState } from "@/lib/store";
import { namesOn } from "@/lib/subname";

export const dynamic = "force-dynamic";

export default async function ApplicantsPage() {
  const st = await readState();
  const list: ApplicantView[] = [];
  for (const a of st.applicants) {
    list.push({
      id: a.id, name: a.name, reach: a.reach, area: a.area, lat: a.lat, lon: a.lon, roles: a.roles, transport: a.transport, hours: a.hours, why: a.why, lightning: a.lightning, npub: a.npub, crewName: a.crewName, nameState: a.crewNameState ? { status: a.crewNameState.status, name: a.crewNameState.name, reason: a.crewNameState.reason } : undefined, stage: a.stage,
      stamp: await stampString(a.createdAt, a.h),
      notes: await Promise.all(a.notes.map(async (n) => ({ stage: n.stage, text: n.text, stamp: await stampString(n.date, n.h) }))),
    });
  }
  const machines = st.machines.filter((m) => m.lat !== undefined).map((m) => ({ id: m.id, name: m.name, lat: m.lat!, lon: m.lon! }));
  const first = machines[0] ?? list.find((a) => a.lat !== undefined);
  const center: [number, number] = first && first.lat !== undefined ? [first.lat, first.lon!] : [41.88, -87.65];
  return (
    <>
      <Nav on="crew" />
      <main className="page wide-page">
        <h1>Crew applicants</h1>
        <p className="muted measure">Any background or driving-record check goes through a screening company with the person&apos;s written OK. Not done here.</p>
        <ApplicantsBoard namesOn={namesOn()} applicants={list} machines={machines} center={center} />
      </main>
    </>
  );
}
