import { Nav } from "@/components/Nav";
import { JobsBoard } from "@/components/JobsBoard";
import { openJobs } from "@/lib/jobs";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const st = await readState();
  const { jobs, bundles, rate } = await openJobs(st);
  const crew = st.applicants.filter((a) => a.stage === "On the crew").map((a) => ({ id: a.id, name: a.name, lat: a.lat, lon: a.lon }));
  return (
    <>
      <Nav on="jobs" />
      <main className="page">
        <h1>Open jobs</h1>
        <p className="muted measure">Pick the stops and jobs you want. Claim one and it shows up under My claimed jobs. Only people On the crew can claim.</p>
        <JobsBoard jobs={jobs} bundles={bundles} crew={crew} rate={rate} />
      </main>
    </>
  );
}
