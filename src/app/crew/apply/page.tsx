import { Nav } from "@/components/Nav";
import { ApplyForm } from "@/components/ApplyForm";
import { CREW_ROLES, type CrewRole } from "@/lib/types";
import { ROLE_COPY } from "@/lib/crew";

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const r = CREW_ROLES.find((x) => x === role) as CrewRole | undefined;
  return (
    <>
      <Nav on="crew" />
      <main className="page narrow">
        <h1>{r ? `Apply: ${ROLE_COPY[r].title}` : "Apply to the crew"}</h1>
        {r && <p className="muted">{ROLE_COPY[r].body}</p>}
        <ApplyForm initialRole={r} center={[41.88, -87.65]} />
      </main>
    </>
  );
}
