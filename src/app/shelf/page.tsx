import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Empty } from "@/components/Shell";
import { readState, LOCAL_FOOD_NOTE, isFood } from "@/lib/store";
import { sats } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShelfPage() {
  const st = await readState();
  const name = (id: string) => { const m = st.machines.find((x) => x.id === id); return m ? `${m.name} at ${m.hostName}` : "a machine"; };
  return (
    <>
      <Nav on="shelf" />
      <main className="page">
        <div className="rowflex"><h1>Local shelf</h1><span className="btnrow"><Link className="btn" href="/shelf/mine">My listings</Link><Link className="btn gild" href="/shelf/new">List an item</Link></span></div>
        <p className="muted measure">Neighbours put what they make in a machine near them: honey, eggs, baked goods, crafts. Priced in sats. The machine host approves every item first.</p>
        {st.listings.length === 0 ? (
          <Empty title="No local items yet">
            <p className="muted">Be the first to list something for a machine near you.</p>
          </Empty>
        ) : (
          <div className="cards">
            {st.listings.map((l) => (
              <Link key={l.id} href={`/shelf/${l.id}`} className="glass card item">
                <span className={`chip st-${l.status}`}>{l.status}</span>
                <h2>{l.item}</h2>
                <div className="muted small">{l.madeBy}</div>
                <div className="foot2"><span className="num">{sats(l.priceSats)}</span><span className="muted small">{name(l.machine)}</span></div>
                {isFood(l.kind) && <span className="muted small">{LOCAL_FOOD_NOTE.split(".")[0]}.</span>}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
