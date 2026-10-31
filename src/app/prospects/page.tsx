import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Empty } from "@/components/Shell";
import { findProspect } from "@/lib/overpass";
import { readState } from "@/lib/store";
import { STAGES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const st = await readState();
  const rows = [];
  for (const [id, stage] of Object.entries(st.tracked)) {
    const h = await findProspect(id);
    if (h) rows.push({ id, stage, p: h.prospect });
  }
  rows.sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage));
  return (
    <>
      <Nav on="prospects" />
      <main className="page">
        <h1>Prospects you are tracking</h1>
        {rows.length === 0 ? (
          <Empty title="Nothing tracked yet">
            <p className="muted">Open a place on the Scout map and press Track this place. It lands here with its stage.</p>
            <div className="actions"><Link className="btn gild" href="/scout">Go to the map</Link></div>
          </Empty>
        ) : (
          <div className="glass card">
            <table>
              <thead><tr><th>Place</th><th>Stage</th><th className="r">Score</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td><Link href={`/prospects/${r.id}`}>{r.p.name}</Link></td><td>{r.stage}</td><td className="r num">{r.p.score}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
