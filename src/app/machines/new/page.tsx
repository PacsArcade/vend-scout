import { Nav } from "@/components/Nav";
import { MachineForm, type Choice } from "@/components/MachineForm";
import { findProspect } from "@/lib/overpass";
import { readState } from "@/lib/store";
import { EMPTY_PROFILE } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewMachine({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  const { prospect } = await searchParams;
  const st = await readState();
  const choices: Choice[] = [];
  for (const [id, stage] of Object.entries(st.tracked)) {
    const h = await findProspect(id);
    if (h) choices.push({ id, name: h.prospect.name, stage });
  }
  if (prospect && !choices.some((c) => c.id === prospect)) {
    const h = await findProspect(prospect);
    if (h) choices.unshift({ id: prospect, name: h.prospect.name, stage: "Not tracked yet" });
  }
  return (
    <>
      <Nav on="machines" />
      <main className="page narrow">
        <h1>Place a machine</h1>
        <p className="muted">A machine is placed at a prospect. The place becomes its host and moves to Placed.</p>
        <div className="glass card">
          <MachineForm mode="create" initial={EMPTY_PROFILE} choices={choices} chosen={prospect} />
        </div>
      </main>
    </>
  );
}
