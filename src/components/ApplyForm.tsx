"use client";
import { useState } from "react";
import Link from "next/link";
import { MiniMap } from "./MiniMap";
import { CREW_ROLES, TRANSPORT, type CrewRole } from "@/lib/types";
import { ROLE_COPY } from "@/lib/crew";

export function ApplyForm({ initialRole, center }: { initialRole?: CrewRole; center: [number, number] }) {
  const [roles, setRoles] = useState<CrewRole[]>(initialRole ? [initialRole] : []);
  const [transport, setTransport] = useState<string[]>([]);
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "apply", hp: fd.get("website"), npub: fd.get("npub"), name: fd.get("name"), reach: fd.get("reach"), area: fd.get("area"), lat: pin?.lat, lon: pin?.lon,
        roles, transport, hours: fd.get("hours"), why: fd.get("why"), lightning: fd.get("lightning"),
      }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (j.ok) setDone(true); else setErr(j.error ?? "That did not send. Try again.");
    } catch { setErr("That did not send. Check your connection and try again."); }
    setBusy(false);
  }

  if (done) return (
    <div className="glass card">
      <h2>Thanks, we got it</h2>
      <p>We will reach out to talk. Nothing else is needed from you right now.</p>
      <div className="actions"><Link className="btn gild" href="/crew">Back to the crew page</Link></div>
    </div>
  );

  return (
    <form className="form glass card" onSubmit={submit}>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hpfield" />
      <label><span>Your name</span><input name="name" required maxLength={80} autoComplete="name" /></label>
      <label><span>How to reach you (email or phone)</span><input name="reach" required maxLength={120} autoComplete="email" /></label>
      <label className="wide"><span>Your area, a neighborhood is fine</span><input name="area" required maxLength={80} placeholder="Pilsen, Rogers Park, Fruita" /></label>
      <div className="wide">
        <p className="hint">Or tap the map where you are based. Optional.</p>
        <MiniMap points={[]} center={center} zoom={10} onPlace={(lat, lon) => setPin({ lat, lon })} placed={pin} label="Tap the map to mark your area" />
        <p className="hint" role="status">{pin ? "Area marked." : "No pin yet."}</p>
      </div>
      <fieldset className="wide picker">
        <legend>Which roles interest you?</legend>
        {CREW_ROLES.map((r) => (
          <label key={r} className="check"><input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(toggle(roles, r))} /> <span>{ROLE_COPY[r].title}</span></label>
        ))}
      </fieldset>
      <fieldset className="wide picker">
        <legend>Getting around</legend>
        {TRANSPORT.map((t) => (
          <label key={t} className="check"><input type="checkbox" checked={transport.includes(t)} onChange={() => setTransport(toggle(transport, t))} /> <span>{t}</span></label>
        ))}
      </fieldset>
      <label className="wide"><span>Hours you like</span><input name="hours" maxLength={120} placeholder="Early mornings, weekends" /></label>
      <label className="wide"><span>Why this?</span><textarea name="why" rows={4} maxLength={1000} /></label>
      <label className="wide"><span>Your nostr npub (optional, lets you sign in to the crew pages)</span><input name="npub" maxLength={100} placeholder="npub1..." /></label>
      <label className="wide"><span>Lightning address (optional, where your pay would go)</span><input name="lightning" maxLength={120} placeholder="you@wallet.example" /></label>
      <p className="hint wide">We will never ask for your seed words or keys.</p>
      <p className="hint wide">We only use this to talk with you about the crew.</p>
      <div className="formfoot"><button className="btn gild" type="submit" disabled={busy}>Send my application</button>{err && <span className="err" role="alert">{err}</span>}</div>
    </form>
  );
}
