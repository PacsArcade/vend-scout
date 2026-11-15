"use client";
import { useEffect, useRef, useState } from "react";
import { REPORT_REASONS } from "@/lib/social";
import { FilePick } from "./FilePick";

// r23: report a problem without signing in. On the map's machine card and on the machine page.
// A picture of the machine and a few words are required, to keep out junk. Email is optional, and only shown when mail is set up.

/** Redraw the picture on a canvas, at most 1600 px on the long side. That drops its metadata (location included) and shrinks the upload.
 *  The server strips metadata again whatever comes in. If the browser cannot redraw it, the original goes and the server cleans it. */
async function shrink(f: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    return b ?? f;
  } catch { return f; }
}

export function PublicReport({ machine, machineName, mailOn, onDone, autoFocus }: { machine: string; machineName: string; mailOn: boolean; onDone?: () => void; autoFocus?: boolean }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const first = useRef<HTMLSelectElement>(null);
  const done = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (autoFocus) first.current?.focus(); }, [autoFocus]);
  // the chosen picture's preview: an object URL made when the file is picked, freed when it changes or the form goes
  const pick = (f: File | null) => { setFile(f); if (f) setErr(""); setPreview((old) => { if (old) URL.revokeObjectURL(old); return f ? URL.createObjectURL(f) : null; }); };
  useEffect(() => () => { setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; }); }, []);
  useEffect(() => { if (sent) done.current?.focus(); }, [sent]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!file) return setErr("Add a picture of the machine.");
    if (text.trim().length < 5) return setErr("Say what is wrong in a few words.");
    setBusy(true);
    const fd = new FormData();
    fd.set("reason", reason); fd.set("text", text.trim()); fd.set("hp", hp);
    if (mailOn && email.trim()) fd.set("email", email.trim());
    fd.set("photo", await shrink(file), "machine.jpg");
    try {
      const r = await fetch(`/api/m/${machine}/report`, { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({ ok: false, error: "The server did not answer. Try again." }))) as { ok: boolean; error?: string; note?: string };
      if (j.ok) { setSent(j.note ?? "Thank you. We got your report."); setText(""); setEmail(""); pick(null); }
      else setErr(j.error ?? "The report was not sent. Try again.");
    } catch { setErr("The report was not sent. Check the connection and try again."); }
    setBusy(false);
  }

  if (sent) return (
    <div className="reportform">
      <p className="toast" role="status" tabIndex={-1} ref={done}>{sent}</p>
      <div className="acts">
        <button type="button" className="btn" onClick={() => setSent("")}>Send another</button>
        {onDone && <button type="button" className="btn" onClick={onDone}>Done</button>}
      </div>
    </div>
  );
  return (
    <form className="reportform form" onSubmit={send} noValidate>
      <p className="dim">About {machineName}. No sign-in needed. The picture goes only to our operators, never on the site.</p>
      <label><span>What is wrong</span><select ref={first} value={reason} onChange={(e) => setReason(e.target.value)}>{REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <div className="field">
        <span>A picture of the machine (needed)</span>
        <FilePick label={file ? "Change the picture" : "Take or choose a picture"} file={file} onFile={pick} capture />
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise */}
        {preview && <img className="reportprev" src={preview} alt="The picture you chose" />}
      </div>
      <label><span>What happened (needed)</span><textarea rows={3} maxLength={500} value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} placeholder="The B4 slot took my money and dropped nothing" /></label>
      {mailOn && (
        <label><span>Your email (optional)</span><input type="email" inputMode="email" autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          <small className="dim">We send one email to say we got this, with how to sign up as a fren. Then we drop the address: it joins no list and is never shown.</small>
        </label>
      )}
      <input name="website" className="hpfield" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
      {err && <p className="err" role="alert">{err}</p>}
      <div className="acts one">
        <button className="btn gild" type="submit" disabled={busy}>{busy ? "Sending" : "Send the report"}</button>
      </div>
    </form>
  );
}
