"use client";
import { useState } from "react";
import { TypeDrawing } from "./TypeDrawing";
import { MACHINE_TYPES, type MachineType } from "@/lib/types";
import { TYPE_INFO } from "@/lib/machineTypes";

export function HostForm({ prospectId, available, initial }: { prospectId: string; available: Record<string, number>; initial?: { types: MachineType[]; other: string; note: string } }) {
  const [types, setTypes] = useState<MachineType[]>(initial?.types ?? []);
  const [other, setOther] = useState(initial?.other ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (t: MachineType) => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg("");
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "hostPick", prospectId, types, other, note }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (j.ok) setMsg("Thank you. We saved what you would like and will be in touch."); else setErr(j.error ?? "That did not send. Try again.");
  }
  return (
    <form onSubmit={send}>
      <div className="typecards">
        {MACHINE_TYPES.filter((t) => t !== "other").map((t) => {
          const info = TYPE_INFO[t];
          const n = available[t] ?? 0;
          return (
            <label key={t} className={"typecard glass" + (types.includes(t) ? " pick" : "")}>
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggle(t)} />
              <TypeDrawing type={t} size={64} />
              <span className="tc-body">
                <b>{info.label}</b>
                <span>{info.sells}</span>
                <span className="muted small">{info.footprint}. {info.power}.</span>
                <span className="chip">{n > 0 ? `${n} ready to place` : "Ask us"}</span>
              </span>
            </label>
          );
        })}
      </div>
      <label className="hostfield"><span>Something else you have in mind?</span><input value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} placeholder="Say it in a few words" /></label>
      <label className="hostfield"><span>Anything we should know about your space?</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} /></label>
      <div className="actions"><button className="btn gild full" type="submit" disabled={busy}>Tell us what I would like</button></div>
      {err && <p className="err" role="alert">{err}</p>}
      {msg && <p className="okmsg small" role="status">{msg}</p>}
    </form>
  );
}
