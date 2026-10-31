"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "./Actions";

interface Row { id: string; name: string; total: number; pct: number }

export function VoteClient({ machine, rows }: { machine: string; rows: Row[] }) {
  const router = useRouter();
  const [pick, setPick] = useState(rows[0]?.id);
  const [backed, setBacked] = useState(false);
  const [msg, setMsg] = useState("");
  const picked = rows.find((r) => r.id === pick) ?? rows[0];
  async function vote() {
    if (!picked) return;
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "vote", machine, option: picked.id, backed }) });
    if (r.ok) { setMsg(`Counted for ${picked.name}.`); router.refresh(); } else setMsg("That vote did not go through.");
  }
  return (
    <>
      {rows.length === 0 && <p className="muted">No options yet. Suggest the first item below.</p>}
      {rows.map((r) => (
        <button key={r.id} className={"opt" + (r.id === picked?.id ? " pick" : "")} onClick={() => setPick(r.id)} aria-pressed={r.id === picked?.id}>
          <span className="optmain"><b>{r.name}</b><span className="vb"><i style={{ width: `${r.pct}%` }} /></span></span>
          <span className="pct num">{r.total} votes</span>
        </button>
      ))}
      <div className="glass tile"><ActionForm action="suggest" extra={{ machine }} submit="Suggest it" doneText="Added." fields={[{ name: "name", label: "Something else?", placeholder: "Suggest an item" }]} /></div>
      {rows.length > 0 && (
        <>
          <label className="muted small check"><input type="checkbox" checked={backed} onChange={(e) => setBacked(e.target.checked)} /> Back my vote with sats (counts double, test mode)</label>
          <div className="actions"><button className="btn gild full" onClick={vote}>Vote for {picked?.name}</button></div>
        </>
      )}
      {msg && <p className="small okmsg" role="status">{msg}</p>}
    </>
  );
}
