"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row { id: string; name: string; total: number; pct: number }
type Res = { ok: boolean; error?: string; note?: string };
const post = async (body: object): Promise<Res> => {
  try {
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: "The server did not answer. Try again." }))) as Res;
  } catch { return { ok: false, error: "No connection. Try again." }; }
};

// r24: the live vote page. Every vote counts 1: the sats-backed vote is hidden until a real payment sits behind it.
export function VoteClient({ machine, rows }: { machine: string; rows: Row[] }) {
  const router = useRouter();
  const [pick, setPick] = useState(rows[0]?.id);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const picked = rows.find((r) => r.id === pick) ?? rows[0];
  async function run(body: object, after?: () => void) {
    setBusy(true); setMsg(""); setErr("");
    const j = await post(body);
    setBusy(false);
    if (j.ok) { setMsg(j.note ?? "Done."); after?.(); router.refresh(); } else setErr(j.error ?? "That did not go through.");
  }
  return (
    <>
      {rows.length === 0 && <p className="muted">No options yet. Suggest the first item below.</p>}
      {rows.map((r) => (
        <button key={r.id} className={"opt" + (r.id === picked?.id ? " pick" : "")} onClick={() => setPick(r.id)} aria-pressed={r.id === picked?.id}>
          <span className="optmain"><b>{r.name}</b><span className="vb"><i style={{ width: `${r.pct}%` }} /></span></span>
          <span className="pct num">{r.total} vote{r.total === 1 ? "" : "s"}</span>
        </button>
      ))}
      {rows.length > 0 && <div className="actions"><button className="btn gild full" disabled={busy} onClick={() => picked && run({ action: "vote", machine, option: picked.id })}>Vote for {picked?.name}</button></div>}
      {msg && <p className="toast" role="status">{msg}</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <form className="glass tile form suggestform" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setErr("Type an item first."); return; } void run({ action: "suggest", machine, name }, () => setName("")); }}>
        <label><span>Something else?</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Suggest an item" /></label>
        <button className="btn" type="submit" disabled={busy}>Suggest it</button>
      </form>
    </>
  );
}
