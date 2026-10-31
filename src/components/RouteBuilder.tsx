"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MiniMap, type MapPoint } from "./MiniMap";

export interface MachineOpt { id: string; name: string; host: string; lat: number; lon: number; low: number; topVote?: string }
export interface RunnerOpt { id: string; name: string }

export function RouteBuilder({ machines, runners, center }: { machines: MachineOpt[]; runners: RunnerOpt[]; center: [number, number] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [runner, setRunner] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const byId = new Map(machines.map((m) => [m.id, m]));
  const toggle = (id: string) => setStops((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const move = (i: number, d: number) => setStops((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const suggested = machines.filter((m) => m.low > 0 || m.topVote).sort((a, b) => b.low - a.low).slice(0, 8);
  const points: MapPoint[] = machines.map((m) => ({ id: m.id, lat: m.lat, lon: m.lon, kind: stops.includes(m.id) ? "chosen" : "machine", label: m.name }));

  async function create() {
    setBusy(true); setErr("");
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createRoute", name, runner: runner || undefined, stops }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not work");
    setName(""); setStops([]); setRunner(""); router.refresh();
  }

  if (machines.length === 0) return null;
  return (
    <div className="glass card">
      <h2>Build a route</h2>
      <div className="form">
        <label><span>Route name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Thursday west side" /></label>
        <label><span>Runner</span>
          <select value={runner} onChange={(e) => setRunner(e.target.value)}>
            <option value="">Not assigned yet</option>
            {runners.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      </div>
      <h3 style={{ marginTop: 16 }}>Pick stops on the map or from the list</h3>
      <MiniMap points={points} center={center} zoom={11} onPick={toggle} label="Placed machines. Tap one to add or remove it from the route" />
      <div className="pickrows" style={{ marginTop: 12 }}>
        {machines.map((m) => (
          <label key={m.id} className={"pickrow" + (stops.includes(m.id) ? " pick" : "")}>
            <input type="checkbox" checked={stops.includes(m.id)} onChange={() => toggle(m.id)} />
            <span className="grow">{m.name} at {m.host}</span>
            <span className="muted small">{m.low} low{m.topVote ? `, vote: ${m.topVote}` : ""}</span>
          </label>
        ))}
      </div>
      {suggested.length > 0 && <div className="actions"><button className="btn" onClick={() => setStops(suggested.map((m) => m.id))}>Use the suggested stops</button></div>}
      <p className="muted small">Suggested = machines with low slots first, then the top votes.</p>
      <h3 style={{ marginTop: 12 }}>Stop order. Drag a stop, or use the buttons.</h3>
      {stops.length === 0 ? <p className="muted">No stops yet.</p> : (
        <ol className="stoplist">
          {stops.map((id, i) => (
            <li key={id} className="drag" draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) setStops((s) => { const n = [...s]; const [x] = n.splice(drag, 1); n.splice(i, 0, x); return n; }); setDrag(null); }}>
              <span className="n">{i + 1}</span>
              <span className="grow">{byId.get(id)?.name} <span className="muted small">at {byId.get(id)?.host}</span></span>
              <button className="btn" onClick={() => move(i, -1)} disabled={i === 0}>Up</button>
              <button className="btn" onClick={() => move(i, 1)} disabled={i === stops.length - 1}>Down</button>
              <button className="btn" onClick={() => toggle(id)}>Remove</button>
            </li>
          ))}
        </ol>
      )}
      <div className="formfoot" style={{ marginTop: 14 }}>
        <button className="btn gild" onClick={create} disabled={busy}>Create route</button>
        {err && <span className="err" role="alert">{err}</span>}
      </div>
    </div>
  );
}
