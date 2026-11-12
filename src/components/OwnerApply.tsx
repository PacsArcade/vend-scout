"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchLud16 } from "@/lib/profile";
import { validLightning } from "@/lib/lightning";
import { RENT_PREF_LABEL, type RentPref } from "@/lib/types";

declare global { interface Window { nostr?: { signEvent: (e: unknown) => Promise<{ pubkey: string }> } } }

/** Owner sign-in (the same fresh-challenge sign-in as neighbors) and then the application. */
export function OwnerApply() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [ln, setLn] = useState<string | null>(null); // lud16 from their kind 0
  const [payout, setPayout] = useState("");
  const [place, setPlace] = useState<{ area: string; lat: number; lon: number } | null>(null);
  const [placeMsg, setPlaceMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function afterKey(hex: string) {
    setPubkey(hex);
    const l = await fetchLud16(hex);
    setLn(l);
    if (l) setPayout(l);
  }
  useEffect(() => { void (async () => { const r = await fetch("/api/neighbor/session"); if (r.ok) { const j = (await r.json()) as { pubkey?: string }; if (j.pubkey) await afterKey(j.pubkey); } })(); }, []);

  async function signIn() {
    setErr("");
    if (!window.nostr) return setErr("No nostr signer in this browser. Install one like the nos2x or Alby extension, then try again.");
    setBusy(true);
    let ev: { pubkey: string };
    try { ev = await window.nostr.signEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [], content: `PACS-NEIGHBOR-${Date.now()}` }); }
    catch { setBusy(false); return setErr("Signing was declined. Nothing was sent."); }
    const r = await fetch("/api/neighbor/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: ev }) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
    if (!r.ok || !j?.ok) { setBusy(false); return setErr(j?.reason ?? "Sign-in did not work"); }
    await afterKey(ev.pubkey);
    setBusy(false);
  }
  async function findPlace(q: string) {
    setPlaceMsg(""); setPlace(null);
    if (q.trim().length < 3) return setPlaceMsg("Type the address or place first");
    try {
      const r = await fetch(`/api/place?q=${encodeURIComponent(q.trim())}`);
      const j = (await r.json()) as { ok?: boolean; place?: { name: string; bbox: { south: number; west: number; north: number; east: number } }; error?: string };
      if (!j.ok || !j.place) return setPlaceMsg(j.error ?? "No place found. That is fine, the address is enough.");
      const b = j.place.bbox;
      setPlace({ area: j.place.name, lat: (b.south + b.north) / 2, lon: (b.west + b.east) / 2 });
      setPlaceMsg(`Found: ${j.place.name}`);
    } catch { setPlaceMsg("The place search did not answer. That is fine, the address is enough."); }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr("");
    const v = validLightning(payout);
    if (!v.ok) return setErr(v.error ?? "Add a Lightning address");
    setBusy(true);
    const r = await fetch("/api/owner/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: {
      business: fd.get("business"), address: fd.get("address"), area: place?.area, lat: place?.lat, lon: place?.lon, contactName: fd.get("contactName"), contact: fd.get("contact"),
      wantsHost: fd.get("wantsHost") === "on", rentPref: fd.get("rentPref"), rentNote: fd.get("rentNote"), payout, payoutSource: ln && v.value === ln.toLowerCase() ? "profile" : "entered",
    } }) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(false);
    if (j?.ok) setDone(true); else setErr(j?.error ?? "That did not send. Try again.");
  }

  if (done) return <div className="glass tile"><h2>Thank you</h2><p>We got your application. An operator reads each one and will be in touch. You can check it any time on your <Link href="/owner">owner page</Link>.</p></div>;
  if (!pubkey) return (
    <div className="glass tile">
      <h2>Sign in with nostr</h2>
      <p className="muted small">You need a nostr signer, like the nos2x or Alby browser extension. We never see your private key. Signing in only proves the key is yours.</p>
      <div className="actions"><button className="btn gild full" onClick={signIn} disabled={busy}>Sign in with nostr</button></div>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
  const fromProfile = !!ln && payout.trim().toLowerCase() === ln.toLowerCase();
  return (
    <form className="glass tile form" onSubmit={submit}>
      <label className="wide"><span>Business or location name</span><input name="business" required maxLength={100} placeholder="Sunrise Laundromat" /></label>
      <label className="wide"><span>Address</span><input name="address" maxLength={200} placeholder="123 Main St, Springfield" /></label>
      <div className="formfoot"><button type="button" className="btn" onClick={(e) => { const f = (e.currentTarget.closest("form") as HTMLFormElement).elements.namedItem("address") as HTMLInputElement; void findPlace(f.value); }}>Find the place</button><span className="muted small" role="status">{placeMsg || "Optional. It helps us put you on the map."}</span></div>
      <label><span>Contact name</span><input name="contactName" maxLength={80} /></label>
      <label><span>Email or phone</span><input name="contact" required maxLength={120} /></label>
      <label className="wide check"><input type="checkbox" name="wantsHost" defaultChecked /><span>I want a machine hosted at this location</span></label>
      <label><span>How would you like rent?</span><select name="rentPref" defaultValue="open">{(Object.keys(RENT_PREF_LABEL) as RentPref[]).map((k) => <option key={k} value={k}>{RENT_PREF_LABEL[k]}</option>)}</select></label>
      <label><span>Anything about rent terms</span><input name="rentNote" maxLength={400} placeholder="Optional" /></label>
      <label className="wide"><span>Lightning address for rent</span><input value={payout} onChange={(e) => setPayout(e.target.value)} required maxLength={200} placeholder="you@wallet.example" inputMode="email" autoCapitalize="none" /></label>
      <p className="muted small wide" style={{ gridColumn: "1/-1" }}>{fromProfile ? "from your nostr profile. Change it above to use another address." : ln ? `Your nostr profile has ${ln}. You are using a different address.` : "We could not find a Lightning address on your nostr profile, so type one. A Lightning address looks like an email."}</p>
      <div className="formfoot"><button className="btn gild" disabled={busy}>Send my application</button>{err && <span className="err" role="alert">{err}</span>}</div>
    </form>
  );
}
