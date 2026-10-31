import { Nav } from "@/components/Nav";
import { ActionForm } from "@/components/Actions";
import { findProspect } from "@/lib/overpass";

export const dynamic = "force-dynamic";

export default async function NewMachine({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  const { prospect } = await searchParams;
  const hit = prospect ? await findProspect(prospect) : null;
  return (
    <>
      <Nav on="machines" />
      <main className="page narrow">
        <h1>Add a machine</h1>
        <p className="muted">{hit ? `It will be placed at ${hit.prospect.name}.` : "No prospect chosen. You can place it anywhere and name the host yourself."}</p>
        <div className="glass card">
          <ActionForm action="addMachine" extra={{ prospectId: hit ? prospect : undefined }} submit="Add machine" redirect="/machines/{id}"
            fields={[
              { name: "name", label: "Machine name", placeholder: "Machine 01", value: hit ? hit.prospect.name : undefined, wide: true },
              { name: "host", label: "Host", placeholder: "Who owns the space", value: hit?.prospect.name, wide: true },
              { name: "hostSharePct", label: "Host share (%)", type: "number", value: 10, min: 0, max: 50 },
            ]} />
        </div>
      </main>
    </>
  );
}
