import Link from "next/link";
import { Nav } from "@/components/Nav";
import { MachineForm } from "@/components/MachineForm";
import { TypeDrawing } from "@/components/TypeDrawing";
import { Empty } from "@/components/Shell";
import { readState } from "@/lib/store";
import { typeLabel } from "@/lib/machineTypes";
import { EMPTY_PROFILE, MACHINE_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const st = await readState();
  return (
    <>
      <Nav on="machines" />
      <main className="page">
        <div className="rowflex"><h1>Machine inventory</h1><span className="btnrow"><Link className="btn" href="/machines/items">Item catalog</Link><Link className="btn" href="/machines/new">Place a machine</Link></span></div>
        <p className="muted measure">Every machine starts here, In storage. Only a machine In storage can be placed at a prospect.</p>
        {st.machines.length === 0 ? (
          <Empty title="No machines in inventory yet"><p className="muted">Add the first one below.</p></Empty>
        ) : (
          <div className="cards">
            {st.machines.map((m) => (
              <Link key={m.id} href={`/machines/${m.id}`} className="glass card item">
                <TypeDrawing type={m.type} size={56} />
                <span className={"chip st-" + (m.status === "Placed" ? "approved" : m.status === "In storage" ? "pending" : "declined")}>{m.status}</span>
                <h2>{m.name}</h2>
                <div className="muted small">{typeLabel(m.type, m.typeOther)}{m.profile.make || m.profile.model ? ` · ${[m.profile.make, m.profile.model].filter(Boolean).join(" ")}` : ""}</div>
                <div className="muted small">{m.status === "Placed" ? `At ${m.hostName}` : "Not placed"}</div>
              </Link>
            ))}
          </div>
        )}
        <div className="glass card narrowcard">
          <h2>Add a machine to inventory</h2>
          <p className="muted small">Statuses: {MACHINE_STATUSES.join(", ")}. A new machine starts In storage.</p>
          <MachineForm mode="inventory" initial={EMPTY_PROFILE} />
        </div>
      </main>
    </>
  );
}
