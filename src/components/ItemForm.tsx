"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePick } from "./FilePick";

export function ItemForm() {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget; const fd = new FormData(f);
    setBusy(true); setErr(""); setDone("");
    let file: string | undefined;
    if (photo) {
      const up = new FormData(); up.set("file", photo);
      const u = (await (await fetch("/api/itemphoto", { method: "POST", body: up })).json()) as { ok: boolean; file?: string; error?: string };
      if (!u.ok) { setBusy(false); return setErr(u.error ?? "The photo did not upload"); }
      file = u.file;
    }
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addItem", name: fd.get("name"), size: fd.get("size"), priceSats: Number(fd.get("priceSats")), photo: file }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not work");
    f.reset(); setPhoto(null); setDone("Item added."); router.refresh();
  }
  return (
    <form className="form" onSubmit={submit}>
      <label className="wide"><span>Item name</span><input name="name" required maxLength={60} placeholder="Hot chips, 2 oz bag" /></label>
      <label><span>Slot size</span><select name="size" defaultValue="standard"><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select></label>
      <label><span>Price (sats)</span><input name="priceSats" type="number" min={1} defaultValue={3000} required /></label>
      <div className="wide"><FilePick label="Add a reference photo" file={photo} onFile={setPhoto} capture />
        <p className="hint">A clear photo of the item as it looks in the machine. The checker compares the glass to it.</p></div>
      <div className="formfoot"><button className="btn gild" type="submit" disabled={busy}>Add to catalog</button>{err && <span className="err" role="alert">{err}</span>}{done && <span className="okmsg" role="status">{done}</span>}</div>
    </form>
  );
}
