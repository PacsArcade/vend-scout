import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ActionButton } from "@/components/Actions";
import { LOCAL_FOOD_NOTE, isFood, readState } from "@/lib/store";
import { Bft } from "@/components/Bft";
import { sats } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const st = await readState();
  const l = st.listings.find((x) => x.id === id);
  if (!l) notFound();
  const m = st.machines.find((x) => x.id === l.machine);
  return (
    <>
      <Nav on="shelf" />
      <main className="page narrow">
        <div className="glass card">
          <span className={`chip st-${l.status}`}>{l.status === "pending" ? "waiting for the host" : l.status}</span>
          <h1>{l.item}</h1>
          <p className="muted">Made by {l.madeBy}</p>
          <div className="sheetrows">
            <div className="row"><span>Price</span><b>{sats(l.priceSats)}</b></div>
            <div className="row"><span>How many</span><b>{l.qty}</b></div>
            <div className="row"><span>Machine</span><b>{m ? <Link href={`/machines/${m.id}`}>{m.name} at {m.hostName}</Link> : "unknown"}</b></div>
            <div className="row"><span>Pickup window</span><b>{l.pickupWindow}</b></div>
            <div className="row"><span>Payout</span><b>{l.lightning ? "Lightning address on file" : "None"}</b></div>
            <div className="row"><span>Kind</span><b>{l.kind}</b></div>
            <div className="row"><span>Listed</span><b><Bft iso={l.createdAt} h={l.h} /></b></div>
          </div>
          {isFood(l.kind) && <p className="note-food">{LOCAL_FOOD_NOTE}</p>}
          {l.status === "pending" && (
            <div className="actions">
              <ActionButton label="Approve" gild payload={{ action: "decide", id: l.id, status: "approved" }} />
              <ActionButton label="Decline" payload={{ action: "decide", id: l.id, status: "declined" }} />
            </div>
          )}
          {l.status === "pending" && <p className="muted small">The host decides. There is no sign-in in v0, so these buttons are open to anyone.</p>}
          {l.status === "approved" && m && <div className="actions"><Link className="btn gild" href={`/machines/${m.id}`}>See it in the machine</Link></div>}
        </div>
      </main>
    </>
  );
}
