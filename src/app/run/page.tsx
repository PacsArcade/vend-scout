import { PhoneBar } from "@/components/PhoneBar";
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
    const pr = st.proofs.find((p) => p.ref === c.job);
    const mid = c.job.startsWith("restock:") || c.job.startsWith("tech:") ? c.job.split(":")[1] : undefined;
    const mach = st.machines.find((m) => m.id === mid);
    const loadList = mach && c.kind === "restock" ? mach.slots.filter((s) => s.kind !== "pickup" && s.level < 0.45).map((s) => ({ code: s.code, label: s.name })) : [];
    claims.push({ job: c.job, by: c.by, title: c.title, sats: c.sats, stamp: await stampString(c.at, c.h), done: !!c.doneAt, doneStamp: c.doneAt ? await stampString(c.doneAt, c.doneH) : undefined, lat: at?.lat, lon: at?.lon, lightning: st.applicants.find((a) => a.id === c.by)?.lightning, proof: pr ? { status: pr.status, reason: pr.reason, points: pr.points } : undefined, loadList });
  }
  const pops = st.proofs.filter((p) => p.status === "approved" && !p.popSeen).map((p) => ({ id: p.id, by: p.by, title: "", points: p.points ?? 0, sats: p.paidSats ?? 0, breakdown: p.breakdown ?? [] }));
  const routes: RouteView[] = st.routes.filter((r) => r.runner).map((r) => ({ id: r.id, name: r.name, runner: r.runner!, stops: r.stops.length, logged: r.done.length }));
  return (
    <div className="phonewrap">
      <div className="phone">
        <PhoneBar right="my work" />
        <h1>My claimed jobs</h1>
        <MyWork crew={people.map((a) => ({ id: a.id, name: a.name }))} claims={claims} routes={routes} initial={crew && people.some((p) => p.id === crew) ? crew : undefined} pops={pops} />
      </div>
    </div>
  );
}
