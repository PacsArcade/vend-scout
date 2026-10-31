"use client";
import { useState } from "react";

interface Row { id: string; name: string; total: number; pct: number }

export function VoteClient({ machine, machineName, initial }: { machine: string; machineName: string; initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [pick, setPick] = useState(initial[0]?.id);
  const [backed, setBacked] = useState(false);
  const [sug, setSug] = useState("");
  const [msg, setMsg] = useState("");
  async function post(body: object) {
    const r = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machine, ...body }) });
    setRows((await r.json()) as Row[]);
  }
  const picked = rows.find((r) => r.id === pick);
  return (
    <>
      {rows.map((r) => (
        <button key={r.id} className={"opt" + (r.id === pick ? " pick" : "")} onClick={() => setPick(r.id)} aria-pressed={r.id === pick}>
          <span style={{ flex: 1 }}><b>{r.name}</b><span className="vb" style={{ display: "block" }}><i style={{ width: `${r.pct}%`, display: "block" }} /></span></span>
          <span className="pct">{r.total} votes</span>
        </button>
      ))}
      <form className="glass" style={{ padding: "12px 14px", marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}
        onSubmit={async (e) => { e.preventDefault(); if (sug.trim()) { await post({ suggest: sug }); setSug(""); setMsg("Added. Thanks."); } }}>
        <input value={sug} onChange={(e) => setSug(e.target.value)} placeholder="Something else?" aria-label="Suggest an item" maxLength={40}
          style={{ flex: 1, minWidth: 0, background: "none", border: 0, color: "var(--ink)", font: "inherit", outline: "none" }} />
        <button type="submit" style={{ background: "none", border: 0, color: "var(--gild)", font: "inherit", cursor: "pointer" }}>Suggest it</button>
      </form>
      <label className="muted small" style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <input type="checkbox" checked={backed} onChange={(e) => setBacked(e.target.checked)} /> Back my vote with sats (counts double, test mode)
      </label>
      <div className="actions"><button className="btn gild full" disabled={!picked} onClick={async () => { await post({ option: pick, backed }); setMsg(`Counted for ${picked?.name}.`); }}>Vote for {picked?.name ?? "..."}</button></div>
      {msg && <p className="small" style={{ color: "var(--gild)", marginTop: 10 }}>{msg}</p>}
      <p className="muted small" style={{ marginTop: 12 }}>Got a Lightning wallet? Back your vote with sats and it counts double. The sats go toward the first box. {machineName}</p>
    </>
  );
}
