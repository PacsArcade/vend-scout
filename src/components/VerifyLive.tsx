"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { stampText } from "@/lib/bft";
import { verifyUnsigned } from "@/lib/verifyevent";
import type { VerifyView } from "@/lib/verifycode";

declare global { interface Window { nostr?: { signEvent: (e: unknown) => Promise<{ pubkey: string }> } } }

/** The signed one-time code. The checker reads the code and watches the status. The crew member taps Sign on their own phone. */
export function VerifyLive({ hex, npub, initial }: { hex: string; npub: string; initial: VerifyView }) {
  const [v, setV] = useState<VerifyView>(initial);
  const [left, setLeft] = useState(initial.secondsLeft);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const code = useRef(initial.code);
  const signedThis = useRef(initial.state === "signed");

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/verify/${npub}`, { cache: "no-store" });
      const j = (await r.json()) as VerifyView & { ok: boolean };
      if (!j.ok) return;
      if (j.code !== code.current) { if (!signedThis.current) setExpired(true); code.current = j.code; signedThis.current = false; setMsg(""); }
      if (j.state === "signed") { signedThis.current = true; setExpired(false); }
      setV(j); setLeft(j.secondsLeft);
    } catch { /* keep the last view */ }
  }, [npub]);

  useEffect(() => { const t = setInterval(poll, 4000); return () => clearInterval(t); }, [poll]);
  useEffect(() => { const t = setInterval(() => setLeft((n) => { if (n <= 1) { void poll(); return 0; } return n - 1; }), 1000); return () => clearInterval(t); }, [poll]);

  async function sign() {
    setMsg("");
    if (!window.nostr) return setMsg("No nostr signer in this browser. Open this page on the phone or browser that holds the crew key.");
    setBusy(true);
    try {
      const ev = await window.nostr.signEvent(verifyUnsigned(hex, v.code));
      const r = await fetch(`/api/verify/${npub}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: ev }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!j?.ok) setMsg(j?.error ?? "That did not work"); else setMsg("Signed. The checker's page will update.");
      await poll();
    } catch { setMsg("Signing was declined. Nothing was sent."); } finally { setBusy(false); }
  }

  if (v.state === "not-crew") return null;
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <div className="glass card" aria-label="Signed one-time code">
      <h2>Prove it is them</h2>
      <p className="muted small">The crew member signs this code on their own phone. No photo needed.</p>
      <p className="mono" style={{ fontSize: 40, letterSpacing: "0.2em", textAlign: "center", margin: "12px 0" }} aria-label={`Code ${v.code.split("").join(" ")}`}>{v.code}</p>
      <p className="muted small" style={{ textAlign: "center" }}>New code in <span className="num">{mm}</span></p>
      <div role="status" style={{ marginTop: 12 }}>
        {v.state === "signed" && <p className="okmsg">Signed just now by this crew key. <span className="mono stamp">{v.signedH ? stampText(v.signedH) : "block unknown"}</span></p>}
        {v.state === "wrong-key" && <p className="err">This code was signed by a different key, not the crew key on this page.{v.wrongBy ? ` Key: ${v.wrongBy.slice(0, 14)}...` : ""}</p>}
        {v.state === "waiting" && <p>{expired ? "Code expired, new code shown." : "Not signed yet."}{v.lastSignedH ? <span className="muted small"> Last signed at {stampText(v.lastSignedH)}.</span> : null}</p>}
      </div>
      <div className="actions"><button className="btn gild full" onClick={sign} disabled={busy}>Sign this code</button></div>
      {msg && <p className={msg.startsWith("Signed.") ? "okmsg" : "err"} role="alert">{msg}</p>}
    </div>
  );
}
