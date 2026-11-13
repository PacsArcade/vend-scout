import { Nav } from "@/components/Nav";
import { stampString } from "@/components/Bft";
import { HostApps, type HostView } from "@/components/HostApps";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const st = await readState();
  const views: HostView[] = [];
  for (const a of st.hostApps ?? []) views.push({ app: a, stamp: await stampString(a.createdAt, a.h), notes: await Promise.all(a.notes.map(async (n) => ({ stage: n.stage, text: n.text, stamp: await stampString(n.date, n.h) }))) });
  return (
    <>
      <Nav on="admin" />
      <main className="page wide-page">
        <h1>Owner applications</h1>
        <p className="intro">Location owners who want to host a machine. Approving links the machine to their key and sets the rent. Rent lines then appear on the <a href="/admin/rent">rent desk</a>.</p>
        <HostApps views={views} machines={st.machines.filter((m) => m.status !== "Retired").map((m) => ({ id: m.id, name: m.name, owner: !!m.ownerNpub }))} />
      </main>
    </>
  );
}
