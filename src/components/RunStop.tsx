"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePick } from "./FilePick";

export function RunStop({ route, machine }: { route: string; machine: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  async function done() {
    setBusy(true); setErr("");
    let file: string | undefined;
    if (photo) {
      const fd = new FormData(); fd.set("route", route); fd.set("file", photo);
      const u = (await (await fetch("/api/stopphoto", { method: "POST", body: fd })).json()) as { ok: boolean; file?: string; error?: string };
      if (!u.ok) { setErr(u.error ?? "The photo did not upload"); setBusy(false); return; }
      file = u.file;
    }
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stopDone", route, machine, photo: file }) });
    const j = (await r.json()) as { ok: boolean; error?: string; note?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not work");
    setPhoto(null); setToast(j.note ?? "Stop logged."); setTimeout(() => router.refresh(), 2500);
  }
  return (
    <div>
      <FilePick label="Snap a photo" file={photo} onFile={setPhoto} capture />
      <div className="actions"><button className="btn gild full" onClick={done} disabled={busy}>Mark done</button></div>
      {err && <p className="err" role="alert">{err}</p>}
      {toast && <p className="toast" role="status">{toast}</p>}
    </div>
  );
}
