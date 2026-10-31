/* eslint-disable @next/next/no-img-element */
import { Nav } from "@/components/Nav";
import { ItemForm } from "@/components/ItemForm";
import { Empty } from "@/components/Shell";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const st = await readState();
  return (
    <>
      <Nav on="machines" />
      <main className="page">
        <h1>Item catalog</h1>
        <p className="muted measure">Every stock item, with a reference photo. Slots point at catalog items, and the photo checker uses the reference photo to see if the right item went in.</p>
        {st.items.length === 0 ? <Empty title="No items yet"><p className="muted">Add the first one below.</p></Empty> : (
          <div className="cards">
            {st.items.map((i) => (
              <div key={i.id} className="glass card item">
                {i.photo ? <img className="itemimg" src={`/api/itemphoto/${i.photo}`} alt={`Reference photo of ${i.name}`} /> : <div className="itemimg nophoto muted small">No photo yet</div>}
                <h2>{i.name}</h2>
                <div className="muted small">{i.size} slot</div>
                <div className="num">{i.priceSats.toLocaleString("en-US")} sats</div>
              </div>
            ))}
          </div>
        )}
        <div className="glass card narrowcard"><h2>Add an item</h2><ItemForm /></div>
      </main>
    </>
  );
}
