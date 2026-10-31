"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TypeDrawing } from "./TypeDrawing";
import type { MachineType } from "@/lib/types";
import { typeLabel } from "@/lib/machineTypes";

export interface InvChoice { id: string; name: string; type: MachineType; typeOther?: string }
export interface PlaceChoice { id: string; name: string; stage: string }

export function PlaceForm({ inventory, places, chosenPlace }: { inventory: InvChoice[]; places: PlaceChoice[]; chosenPlace?: string }) {
  const router = useRouter();
  const [machine, setMachine] = useState(inventory[0]?.id ?? "");
  const [prospect, setProspect] = useState(chosenPlace ?? "");
  const [filter, setFilter] = useState("");
  const [share, setShare] = useState(10);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const list = places.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!machine) return setErr("Pick a machine from inventory.");
    if (!prospect) return setErr("Pick the place that hosts it.");
    setBusy(true);
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "placeMachine", machine, prospectId: prospect, hostSharePct: share }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not work");
    router.push(`/machines/${machine}`);
  }

  return (
    <form className="form" onSubmit={submit}>
      <fieldset className="wide picker">
        <legend>1. Which machine from inventory?</legend>
        <div className="pickrows">
          {inventory.map((m) => (
            <label key={m.id} className={"pickrow" + (m.id === machine ? " pick" : "")}>
              <input type="radio" name="machine" checked={m.id === machine} onChange={() => setMachine(m.id)} />
              <span className="typedot"><TypeDrawing type={m.type} size={32} /></span>
              <span className="grow">{m.name}</span><span className="muted small">{typeLabel(m.type, m.typeOther)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="wide picker">
        <legend>2. Which place hosts it?</legend>
        {places.length === 0 ? <p className="muted">No places are tracked yet. A machine is placed at a prospect, so find one on the map and press Track this place.</p> : (
          <>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search your tracked places" aria-label="Search your tracked places" />
            <div className="pickrows">
              {list.map((c) => (
                <label key={c.id} className={"pickrow" + (c.id === prospect ? " pick" : "")}>
                  <input type="radio" name="prospect" checked={c.id === prospect} onChange={() => setProspect(c.id)} />
                  <span className="grow">{c.name}</span><span className="muted small">{c.stage}</span>
                </label>
              ))}
              {list.length === 0 && <p className="muted small">No tracked place matches that.</p>}
            </div>
          </>
        )}
        <Link className="btn" href="/scout">Track a new place</Link>
      </fieldset>
      <label><span>Host share (%)</span><input type="number" min={0} max={50} value={share} onChange={(e) => setShare(Number(e.target.value))} required /></label>
      <div className="formfoot">
        <button className="btn gild" type="submit" disabled={busy}>Place machine</button>
        {err && <span className="err" role="alert">{err}</span>}
      </div>
    </form>
  );
}
