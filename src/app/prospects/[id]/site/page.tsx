import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { ActionButton } from "@/components/Actions";
import { findProspect } from "@/lib/overpass";
import { osmContacts } from "@/lib/contacts";
import { distM } from "@/lib/score";
import { LOCAL_FOOD_NOTE, isFood, readState } from "@/lib/store";
import { sats } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/types";
import { noPublisher } from "@/lib/sitePublish";

export const dynamic = "force-dynamic";

export default async function SitePackage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hit = await findProspect(id);
  if (!hit) notFound();
  const p = hit.prospect;
  const st = await readState();
  const pkg = st.packages[id];
  const phone = osmContacts(p.tags).find((c) => c.kind === "phone")?.value;
  const near = st.machines.filter((m) => m.lat !== undefined && distM([p.lat, p.lon], [m.lat!, m.lon!]) <= 15000);
  const here = st.machines.find((m) => m.prospectId === id);
  const items = st.listings.filter((l) => l.status === "approved" && near.some((m) => m.id === l.machine));
  const pickup = here ?? near[0];
  const foodOnPage = items.some((l) => isFood(l.kind));
  return (
    <>
      <Nav on="prospects" />
      <main className="page">
        <div className="rowflex">
          <div><h1>Site package for {p.name}</h1><p className="muted">Preview only. Nothing is published, no domain, no hosting. Part of the machine package.</p></div>
          <Link className="btn" href={`/prospects/${id}`}>Back to the prospect</Link>
        </div>
        <div className="glass card">
          <div className="rowflex">
            <div>
              <h2>Package status: {pkg ? pkg.status : "not started"}</h2>
              {pkg && <p className="muted small">Updated <Bft iso={pkg.updatedAt} h={pkg.h} /></p>}
            </div>
            <span className="btnrow">
              <ActionButton label="Save as drafted" payload={{ action: "package", id, status: "drafted" }} gild={!pkg} />
              <ActionButton label="Mark offered" payload={{ action: "package", id, status: "offered" }} />
              <ActionButton label="Mark accepted" payload={{ action: "package", id, status: "accepted" }} />
            </span>
          </div>
          <p className="muted small">Publishing from our templates is not built yet. This page is a preview only ({noPublisher.name}).</p>
        </div>
        <div className="sitepreview" aria-label="Site preview">
          <div className="sp-bar"><span>{p.name}</span><span className="muted small">frens.earth look · preview</span></div>
          <div className="sp-hero">
            <h2>{p.name}</h2>
            <p>{CATEGORY_LABEL[p.category]} · {p.area}</p>
          </div>
          <div className="sp-grid">
            <section className="glass card">
              <h3>Visit us</h3>
              <p>{p.area}</p>
              <p>{p.openingHours ? `Hours: ${p.openingHours}` : "Hours coming soon."}</p>
              <p>{phone ? `Phone: ${phone}` : "Phone: add it here."}</p>
            </section>
            <section className="glass card">
              <h3>Local shelf: order from local farms</h3>
              {items.length === 0 ? <p className="muted">No local items yet. Neighbours can list honey, eggs, baked goods and crafts here.</p> : (
                <ul className="splist">{items.map((l) => <li key={l.id}><span>{l.item}</span><b className="num">{sats(l.priceSats)}</b></li>)}</ul>
              )}
              {foodOnPage && <p className="muted small">{LOCAL_FOOD_NOTE}</p>}
            </section>
            <section className="glass card">
              <h3>Pick up at our machine</h3>
              <p>{pickup ? `Order online, then collect at ${pickup.name}, any hour.` : "A machine is coming to this spot. Orders from the Arcade shop will wait for you there."}</p>
            </section>
          </div>
          <p className="muted small">Built with Pac&apos;s Arcade as part of the vending machine package.</p>
        </div>
      </main>
    </>
  );
}
