"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePick } from "./FilePick";
import { INSIDE_LABEL, MACHINE_STATES, type Inside, type MachineState } from "@/lib/types";

/** The scout's look inside. "Not checked yet" is the default until this is saved. */
export function ScoutCheckForm({ id, initial, crew }: { id: string; initial?: { inside: Inside; who: string; state?: MachineState; room: string }; crew: { id: string; name: string }[] }) {
  const router = useRouter();
  const [inside, setInside] = useState<Inside | "">(initial?.inside ?? "");
  const [who, setWho] = useState(initial?.who ?? "");
  const [state, setState] = useState<string>(initial?.state ?? "");
  const [room, setRoom] = useState(initial?.room ?? "unsure");
  const [by, setBy] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const hasMachine = inside === "snacks" || inside === "drinks" || inside === "combo";
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOk("");
    if (!inside) return setErr("Pick what is already inside, or leave it as not checked.");
    setBusy(true);
    let file: string | undefined;
    if (photo) {
      const fd = new FormData(); fd.set("route", "r0"); fd.set("file", photo);
      const u = (await (await fetch("/api/stopphoto", { method: "POST", body: fd })).json()) as { ok: boolean; file?: string; error?: string };
      if (!u.ok) { setBusy(false); return setErr(u.error ?? "The photo did not upload"); }
      file = u.file;
    }
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "scoutCheck", id, inside, who, state: hasMachine ? state || undefined : undefined, room, photo: file, by: by || undefined }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not save");
    setOk("Saved. The score now uses your check."); setPhoto(null); router.refresh();
  }
  return (
    <form className="form" onSubmit={save}>
      <label><span>Already inside</span>
        <select value={inside} onChange={(e) => setInside(e.target.value as Inside)}>
          <option value="">Not checked yet</option>
          {(Object.keys(INSIDE_LABEL) as Inside[]).map((k) => <option key={k} value={k}>{INSIDE_LABEL[k]}</option>)}
        </select>
      </label>
      {hasMachine && <label><span>Machine state</span>
        <select value={state} onChange={(e) => setState(e.target.value)}><option value="">Not noted</option>{MACHINE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </label>}
      {hasMachine && <label className="wide"><span>Who runs it (operator name or sticker phone)</span><input value={who} onChange={(e) => setWho(e.target.value)} maxLength={80} placeholder="Name on the sticker, or the phone number" /></label>}
      <label><span>Room for another machine</span>
        <select value={room} onChange={(e) => setRoom(e.target.value)}><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Unsure</option></select>
      </label>
      {crew.length > 0 && <label><span>Checked by (for points)</span>
        <select value={by} onChange={(e) => setBy(e.target.value)}><option value="">Not a crew check</option>{crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>}
      <div className="wide"><FilePick label="Add a photo" file={photo} onFile={setPhoto} capture /></div>
      <div className="formfoot"><button className="btn gild" type="submit" disabled={busy}>Save the check</button>{err && <span className="err" role="alert">{err}</span>}{ok && <span className="okmsg" role="status">{ok}</span>}</div>
    </form>
  );
}
