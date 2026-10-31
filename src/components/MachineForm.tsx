"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScan } from "./BarcodeScan";
import { FilePick } from "./FilePick";
import { TELEMETRY_LABEL, MACHINE_TYPES, type MachineProfile, type MachineType, type Telemetry } from "@/lib/types";
import { TYPE_INFO } from "@/lib/machineTypes";


export function MachineForm({ mode, machineId, initial }: { mode: "inventory" | "edit"; machineId?: string; initial: MachineProfile }) {
  const router = useRouter();
  const [p, setP] = useState<MachineProfile>(initial);
  const [name, setName] = useState("");
  const [type, setType] = useState<MachineType>("snack");
  const [typeOther, setTypeOther] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof MachineProfile>(k: K, v: MachineProfile[K]) => setP((x) => ({ ...x, [k]: v }));

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
    if (mode === "inventory") {
      const r = await post({ action: "addInventory", name, type, typeOther, profile });
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
      {mode === "inventory" && (
        <>
          <label className="wide"><span>Machine name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Machine 01" required /></label>
          <label><span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as MachineType)}>
              {MACHINE_TYPES.map((t) => <option key={t} value={t}>{TYPE_INFO[t].label}</option>)}
            </select>
          </label>
          {type === "other" && <label><span>What kind?</span><input value={typeOther} onChange={(e) => setTypeOther(e.target.value)} placeholder="Say in a few words" /></label>}
        </>
      )}
      <div className="wide"><BarcodeScan onCode={(code) => setP((x) => ({ ...x, rawCode: code, serial: x.serial || code }))} /></div>
      <label className="wide"><span>Scanned or typed label code</span><input value={p.rawCode} onChange={(e) => set("rawCode", e.target.value)} placeholder="Exactly what the label says" /></label>
      <label><span>Make</span><input value={p.make} onChange={(e) => set("make", e.target.value)} /></label>
      <label><span>Model</span><input value={p.model} onChange={(e) => set("model", e.target.value)} /></label>
      <label className="wide"><span>Serial number</span><input value={p.serial} onChange={(e) => set("serial", e.target.value)} /></label>
      <div className="wide"><FilePick label="Add a photo of the label" file={photo} onFile={setPhoto} /></div>
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
        <button className="btn gild" type="submit" disabled={busy}>{mode === "inventory" ? "Add to inventory" : "Save profile"}</button>
        {err && <span className="err" role="alert">{err}</span>}{ok && <span className="okmsg" role="status">{ok}</span>}
      </div>
    </form>
  );
}
