"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePick } from "./FilePick";

export interface LoadItem { code: string; label: string }

/** The runner sends proof: glass before, glass after, load list ticked. Pay comes after a person checks it. */
export function ProofUpload({ kind, refId, route, machine, loadList, retakeReason }: { kind: "job" | "stop"; refId: string; route?: string; machine?: string; loadList: LoadItem[]; retakeReason?: string }) {
  const router = useRouter();
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const up = async (f: File) => {
    const fd = new FormData(); fd.set("route", "r0"); fd.set("file", f);
    return (await (await fetch("/api/stopphoto", { method: "POST", body: fd })).json()) as { ok: boolean; file?: string; error?: string };
  };
  async function send() {
    setErr("");
    if (!before || !after) return setErr("Add both photos: the glass before and the glass after.");
    setBusy(true);
    const [b, a] = [await up(before), await up(after)];
    if (!b.ok || !a.ok) { setBusy(false); return setErr(b.error ?? a.error ?? "A photo did not upload"); }
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submitProof", kind, ref: refId, route, machine, before: b.file, after: a.file, ticked, loadTotal: loadList.length }) });
    const j = (await r.json()) as { ok: boolean; error?: string; note?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not work");
    setMsg(j.note ?? "Proof sent.");
    setTimeout(() => router.refresh(), 1800);
  }
  return (
    <div className="proofbox">
      {retakeReason && <p className="retake" role="status">Retake asked: {retakeReason}</p>}
      {loadList.length > 0 && (
        <fieldset className="picker">
          <legend>Load list. Tick each slot you filled.</legend>
          {loadList.map((l) => (
            <label key={l.code} className="check"><input type="checkbox" checked={ticked.includes(l.code)} onChange={() => setTicked((t) => (t.includes(l.code) ? t.filter((x) => x !== l.code) : [...t, l.code]))} /> <span>{l.code} {l.label}</span></label>
          ))}
        </fieldset>
      )}
      <FilePick label="Photo of the glass before" file={before} onFile={setBefore} capture />
      <FilePick label="Photo of the glass after" file={after} onFile={setAfter} capture />
      <div className="actions"><button className="btn gild full" onClick={send} disabled={busy}>{retakeReason ? "Send the retake" : "Send proof"}</button></div>
      <p className="muted small">You are paid after a person checks your photos. We never score speed. Drive safe.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {msg && <p className="toast" role="status">{msg}</p>}
    </div>
  );
}
