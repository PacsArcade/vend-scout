"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScan } from "./BarcodeScan";
import { TELEMETRY_LABEL, type MachineProfile, type Telemetry } from "@/lib/types";

export interface Choice { id: string; name: string; stage: string }

export function MachineForm({ mode, machineId, initial, choices, chosen }: { mode: "create" | "edit"; machineId?: string; initial: MachineProfile; choices?: Choice[]; chosen?: string }) {
  const router = useRouter();
  const [p, setP] = useState<MachineProfile>(initial);
  const [prospect, setProspect] = useState(chosen ?? "");
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [share, setShare] = useState(10);
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof MachineProfile>(k: K, v: MachineProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  const list = (choices ?? []).filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  async function post(body: object) {
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json()) as { ok: boolean; error?: string; id?: string };
  }
  async function upload(id: string) {
    if (!photo) return true;
    const fd = new FormData();
    fd.set("machine", id); fd.set("file", photo);
    const r = await fetch("/api/label", { method: "POST", body: fd });
    const j = (await r.json()) as { ok: boolean; error?: string };
    if (!j.ok) setErr(j.error ?? "The photo did not upload");
    return j.ok;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOk(""); setBusy(true);
    const profile = { ...p, labelPhoto: undefined };
    if (mode === "create") {
      if (!prospect) { setErr("Pick the place that hosts it first."); setBusy(false); return; }
      const r = await post({ action: "addMachine", name, prospectId: prospect, hostSharePct: share, profile });
      if (!r.ok || !r.id) { setErr(r.error ?? "That did not work"); setBusy(false); return; }
      await upload(r.id);
      router.push(`/machines/${r.id}`);
    } else {
      const r = await post({ action: "profile", machine: machineId, profile });
      if (!r.ok) { setErr(r.error ?? "That did not work"); setBusy(false); return; }
      if (await upload(machineId!)) { setOk("Machine profile saved."); setPhoto(null); router.refresh(); }
    }
    setBusy(false);
  }

  return (
    <form className="form" onSubmit={submit}>
      {mode === "create" && (
        <>
          <fieldset className="wide picker">
            <legend>Which place hosts it?</legend>
            {(choices ?? []).length === 0 ? (
              <p className="muted">No places are tracked yet. A machine is placed at a prospect, so find one on the map and press Track this place.</p>
            ) : (
              <>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search your tracked places" aria-label="Search your tracked places" />
                <div className="pickrows">
                  {list.map((c) => (
                    <label key={c.id} className={"pickrow" + (c.id === prospect ? " pick" : "")}>
                      <input type="radio" name="prospect" checked={c.id === prospect} onChange={() => setProspect(c.id)} />
                      <span>{c.name}</span><span className="muted small">{c.stage}</span>
                    </label>
                  ))}
                  {list.length === 0 && <p className="muted small">No tracked place matches that.</p>}
                </div>
              </>
            )}
            <a className="btn" href="/scout">Track a new place</a>
          </fieldset>
          <label className="wide"><span>Machine name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Machine 01" required /></label>
          <label><span>Host share (%)</span><input type="number" min={0} max={50} value={share} onChange={(e) => setShare(Number(e.target.value))} required /></label>
        </>
      )}
      <div className="wide"><BarcodeScan onCode={(code) => setP((x) => ({ ...x, rawCode: code, serial: x.serial || code }))} /></div>
      <label className="wide"><span>Scanned or typed label code</span><input value={p.rawCode} onChange={(e) => set("rawCode", e.target.value)} placeholder="Exactly what the label says" /></label>
      <label><span>Make</span><input value={p.make} onChange={(e) => set("make", e.target.value)} /></label>
      <label><span>Model</span><input value={p.model} onChange={(e) => set("model", e.target.value)} /></label>
      <label className="wide"><span>Serial number</span><input value={p.serial} onChange={(e) => set("serial", e.target.value)} /></label>
      <label className="wide"><span>Photo of the label</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
      <label><span>Card reader brand</span><input value={p.cardReader} onChange={(e) => set("cardReader", e.target.value)} placeholder="None if blank" /></label>
      <label><span>Telemetry</span>
        <select value={p.telemetry} onChange={(e) => set("telemetry", e.target.value as Telemetry)}>
          {(Object.keys(TELEMETRY_LABEL) as Telemetry[]).map((k) => <option key={k} value={k}>{TELEMETRY_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="check wide"><input type="checkbox" checked={p.cash} onChange={(e) => set("cash", e.target.checked)} /> <span>Takes cash</span></label>
      <label className="check wide"><input type="checkbox" checked={p.lightning} onChange={(e) => set("lightning", e.target.checked)} /> <span>Has a Lightning board fitted</span></label>
      <label className="wide"><span>Notes</span><textarea value={p.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={1000} /></label>
      <div className="formfoot">
        <button className="btn gild" type="submit" disabled={busy}>{mode === "create" ? "Place machine" : "Save profile"}</button>
        {err && <span className="err" role="alert">{err}</span>}{ok && <span className="okmsg" role="status">{ok}</span>}
      </div>
    </form>
  );
}
