"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { KIND0_FIELDS, KIND0_MAX, EMPTY_KIND0, buildKind0Event, fetchKind0Event, parseKind0, publishEvent, verifyNip05, type Kind0, type Kind0Field, type Nip05State, type NostrEvent, type RelayResult } from "@/lib/profile";

/** Read the newest kind 0 for a key, in the browser. */
export function useKind0(hex: string) {
  const [state, setState] = useState<{ loading: boolean; ev: NostrEvent | null; k0: Kind0 }>({ loading: true, ev: null, k0: EMPTY_KIND0 });
  useEffect(() => {
    let live = true;
    void fetchKind0Event(hex).then((ev) => { if (live) setState({ loading: false, ev, k0: ev ? parseKind0(ev.content) : EMPTY_KIND0 }); });
    return () => { live = false; };
  }, [hex]);
  return state;
}
export function useNip05(nip05: string, hex: string, ready: boolean): Nip05State | "checking" {
  const [s, setS] = useState<Nip05State | "checking">("checking");
  useEffect(() => { if (!ready) return; let live = true; void verifyNip05(nip05, hex).then((r) => { if (live) setS(r); }); return () => { live = false; }; }, [nip05, hex, ready]);
  return s;
}
const NIP05_TEXT: Record<Nip05State | "checking", string> = { verified: "Verified", "not verified": "Not verified", unreachable: "Could not check (their domain did not answer)", none: "", checking: "Checking" };

/** Photo and name only. For the badge and the verify page. */
export function NostrFace({ hex, size = 96 }: { hex: string; size?: number }) {
  const { loading, k0 } = useKind0(hex);
  const name = k0.display_name || k0.name;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {k0.picture ? <img src={k0.picture} alt="" width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover" }} referrerPolicy="no-referrer" /> : <span className="faceholder" aria-hidden style={{ width: size, height: size }}><img src="/brand/01-machine-fren-icon.svg" alt="" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} /></span>}
      <div><b>{loading ? "Loading profile" : name || "No name published"}</b>{!loading && !k0.picture && <div className="muted small">No photo published</div>}</div>
    </div>
  );
}

const LABEL: Record<Kind0Field, string> = { display_name: "Display name", name: "Username", about: "About", picture: "Photo (https address)", banner: "Banner (https address)", website: "Website (https)", nip05: "NIP-05 address (name@domain)", lud16: "Lightning address" };

export function NostrProfile({ hex, mine, signedIn }: { hex: string; mine: boolean; signedIn: boolean }) {
  const { loading, ev, k0 } = useKind0(hex);
  const n05 = useNip05(k0.nip05, hex, !loading && !!k0.nip05);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Kind0>(EMPTY_KIND0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<RelayResult[] | null>(null);
  const empty = <span className="muted">Not set</span>;

  async function startEdit() {
    setErr(""); setResults(null);
    // Read the freshest profile right now, so the form starts from what the relays have today.
    setBusy(true);
    const latest = await fetchKind0Event(hex);
    setBusy(false);
    setForm(latest ? parseKind0(latest.content) : EMPTY_KIND0);
    setOpen(true);
  }
  async function save() {
    setErr(""); setResults(null);
    if (!window.nostr) return setErr("No nostr signer in this browser. Install one like the nos2x or Alby extension, then try again.");
    setBusy(true);
    try {
      // Merge onto the newest profile again just before signing, so fields we do not edit (and fields we do not know) are kept.
      const latest = await fetchKind0Event(hex);
      const changed: Partial<Kind0> = {};
      const was = latest ? parseKind0(latest.content) : EMPTY_KIND0;
      for (const f of KIND0_FIELDS) if (form[f] !== was[f]) changed[f] = form[f];
      const unsigned = buildKind0Event(latest, changed);
      let signed: NostrEvent;
      try { signed = (await window.nostr.signEvent(unsigned)) as unknown as NostrEvent; } catch { setBusy(false); return setErr("Signing was declined. Nothing was sent."); }
      if (signed.pubkey !== hex) { setBusy(false); return setErr("Your signer is on a different key than this profile. Nothing was sent."); }
      setResults(await publishEvent(signed));
    } finally { setBusy(false); }
  }
  async function signIn() {
    setErr("");
    if (!window.nostr) return setErr("You need a nostr signer, like the nos2x or Alby browser extension.");
    setBusy(true);
    try {
      const e = await window.nostr.signEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [], content: `PACS-NEIGHBOR-${Date.now()}` });
      if (e.pubkey !== hex) return setErr("That signer is on a different key than this profile.");
      const r = await fetch("/api/neighbor/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: e }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (!r.ok || !j?.ok) return setErr(j?.reason ?? "Sign-in did not work.");
      window.location.reload();
    } catch { setErr("Signing was declined. Nothing was sent."); } finally { setBusy(false); }
  }

  const name = k0.display_name || k0.name;
  return (
    <div className="glass card">
      {k0.banner && <img src={k0.banner} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} referrerPolicy="no-referrer" />}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {k0.picture ? <img src={k0.picture} alt="" width={88} height={88} style={{ borderRadius: "50%", objectFit: "cover" }} referrerPolicy="no-referrer" /> : <div aria-hidden style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />}
        <div>
          <h2 style={{ margin: 0 }}>{loading ? "Loading profile" : name || "No name published"}</h2>
          {k0.display_name && k0.name && <div className="muted small">@{k0.name}</div>}
        </div>
      </div>
      {!loading && !ev && <p className="muted small" role="status">No profile found on the relays we ask. They may be slow, or this key has not published one.</p>}
      <table style={{ marginTop: 12 }}><tbody>
        <tr><td className="muted small">About</td><td>{k0.about || empty}</td></tr>
        <tr><td className="muted small">NIP-05</td><td>{k0.nip05 ? <>{k0.nip05} <span className="chip" role="status">{NIP05_TEXT[n05]}</span></> : empty}</td></tr>
        <tr><td className="muted small">Lightning address</td><td>{k0.lud16 || empty}</td></tr>
        <tr><td className="muted small">Website</td><td>{k0.website ? <a href={k0.website} rel="noopener noreferrer nofollow">{k0.website}</a> : empty}</td></tr>
      </tbody></table>
      {mine && !open && <div className="actions"><button className="btn gild" onClick={startEdit} disabled={busy}>{busy ? "Loading" : "Update my nostr profile"}</button></div>}
      {!mine && !signedIn && <div className="actions"><button className="btn" onClick={signIn} disabled={busy}>This is my key: sign in</button></div>}
      {open && (
        <form className="form" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <p className="muted small">This changes your nostr profile everywhere, not only here. Your signer signs it. We never see your key.</p>
          {KIND0_FIELDS.map((f) => (
            <label key={f}>{LABEL[f]}
              {f === "about" ? <textarea rows={3} maxLength={KIND0_MAX[f]} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /> : <input maxLength={KIND0_MAX[f]} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />}
            </label>
          ))}
          <div className="actions"><button className="btn gild" type="submit" disabled={busy}>{busy ? "Working" : "Sign and publish"}</button><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
      {results && (
        <ul className="plain" role="status" style={{ marginTop: 12 }}>{results.map((r) => <li key={r.relay}><span className="mono small">{r.relay.replace("wss://", "")}</span> {r.ok ? "OK" : `Failed${r.message ? `: ${r.message}` : ""}`}</li>)}</ul>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
