"use client";
import { useEffect, useState } from "react";
import { RELAYS } from "@/lib/profile";
import { REPORT_REASONS, SHARE_TAGS } from "@/lib/social";
import { ZAP_AMOUNTS } from "@/lib/zapconfig";

declare global { interface Window { nostr?: { signEvent: (e: unknown) => Promise<{ pubkey: string }> } } }
type Ev = { pubkey: string; id: string };

const nowSec = () => Math.floor(Date.now() / 1000);
const nowMs = () => Date.now();
async function post(url: string, body: object) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: "The server did not answer" }))) as { ok: boolean; error?: string; note?: string; pr?: string; zap?: boolean; credits?: number; reason?: string };
}
function publish(ev: unknown) { for (const url of RELAYS) { try { const ws = new WebSocket(url); ws.onopen = () => { ws.send(JSON.stringify(["EVENT", ev])); setTimeout(() => ws.close(), 4000); }; } catch { /* next */ } } }

export interface NeighborProps { machine: string; machineName: string; tag: string; origin: string; hasPhoto: boolean; stocker: string; tipOk: boolean; runnerHex: string | null; verifies: number }

export function NeighborPanel(p: NeighborProps) {
  const [signed, setSigned] = useState(false);
  const [credits, setCredits] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<"" | "report" | "request">("");
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [invoice, setInvoice] = useState<{ pr: string; zap: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => { const r = await fetch("/api/neighbor/session"); if (r.ok) { const j = (await r.json()) as { credits: number }; setSigned(true); setCredits(j.credits); } })(); }, []);

  async function signIn(): Promise<boolean> {
    setErr("");
    if (signed) return true;
    if (!window.nostr) { setErr("You need a nostr signer, like the nos2x or Alby browser extension."); return false; }
    let ev: unknown;
    try { ev = await window.nostr.signEvent({ kind: 22242, created_at: nowSec(), tags: [], content: `PACS-NEIGHBOR-${nowMs()}` }); } catch { setErr("Signing was declined. Nothing was sent."); return false; }
    const j = await post("/api/neighbor/session", { event: ev });
    if (!j.ok) { setErr(j.reason ?? "Sign-in did not work"); return false; }
    setSigned(true); setCredits(j.credits ?? 0); return true;
  }
  async function act(body: object, done?: () => void) {
    setBusy(true); setErr(""); setMsg("");
    if (!(await signIn())) { setBusy(false); return; }
    const j = await post("/api/neighbor/act", { machine: p.machine, ...body });
    setBusy(false);
    if (j.credits !== undefined) setCredits(j.credits);
    if (j.ok) { setMsg(j.note ?? "Done."); done?.(); } else { setMsg(j.note ?? ""); setErr(j.error ?? "That did not work"); }
  }
  async function tip(sats: number) {
    setBusy(true); setErr(""); setInvoice(null); setAmount(sats);
    let zapRequest: unknown = null;
    if (p.runnerHex && window.nostr) {
      try { zapRequest = await window.nostr.signEvent({ kind: 9734, created_at: nowSec(), content: "", tags: [["relays", ...RELAYS], ["amount", String(sats * 1000)], ["p", p.runnerHex]] }); } catch { zapRequest = null; }
    }
    const j = await post("/api/zap/invoice", { machine: p.machine, amountSats: sats, zapRequest });
    setBusy(false);
    if (j.ok && j.pr) setInvoice({ pr: j.pr, zap: !!j.zap }); else setErr(j.error ?? "No invoice");
  }
  async function share() {
    setErr(""); setMsg("");
    if (!window.nostr) return setErr("You need a nostr signer, like the nos2x or Alby browser extension.");
    setBusy(true);
    const content = `Found a stocked machine near me. ${SHARE_TAGS(p.machine)}\n${p.origin}/m/${p.machine}${p.hasPhoto ? `\n${p.origin}/api/m/${p.machine}/photo` : ""}`;
    let ev: Ev;
    try { ev = (await window.nostr.signEvent({ kind: 1, created_at: nowSec(), content, tags: [["t", "frensvend"], ["t", p.tag], ["r", `${p.origin}/m/${p.machine}`]] })) as Ev; } catch { setBusy(false); return setErr("Signing was declined. Nothing was posted."); }
    publish(ev);
    await act({ action: "share", event: ev });
  }
  const copy = async (t: string, ok: string) => { try { await navigator.clipboard.writeText(t); setMsg(ok); } catch { setErr("Copy did not work. Select the text instead."); } };

  return (
    <>
      <section className="glass tile" id="tip">
        <h2>Tip the stocker</h2>
        {!p.tipOk ? <p className="muted small">{p.stocker} has no tip address yet.</p> : (
          <>
            <p className="muted small">Goes straight to {p.stocker}&apos;s Lightning address. A thank you, not part of their pay.</p>
            <div className="zapgrid">
              {ZAP_AMOUNTS.map((a) => <button key={a} className={"btn" + (amount === a ? " gild" : "")} onClick={() => tip(a)} disabled={busy}>{a.toLocaleString("en-US")} sats</button>)}
            </div>
            <div className="searchrow">
              <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} placeholder="Pick my own amount" aria-label="Your own amount in sats" />
              <button className="btn" onClick={() => Number(custom) > 0 && tip(Number(custom))} disabled={busy || !custom}>Tip</button>
            </div>
            {invoice && (
              <div className="invoicebox">
                <p className="small">{invoice.zap ? "A zap for" : "An invoice for"} <b className="num">{amount?.toLocaleString("en-US")} sats</b>. Pay it with any Lightning wallet.</p>
                <div className="actions"><a className="btn gild full" href={`lightning:${invoice.pr}`}>Open in my wallet</a><button className="btn full" onClick={() => copy(invoice.pr, "Invoice copied.")}>Copy the invoice</button></div>
                <p className="invoice mono">{invoice.pr}</p>
              </div>
            )}
            <p className="muted small">Pay for the job is separate. A tip can never change it.</p>
          </>
        )}
      </section>

      <section className="glass tile">
        <h2>Second look from a neighbor</h2>
        <p className="muted small">{p.verifies > 0 ? `${p.verifies} neighbor${p.verifies === 1 ? "" : "s"} checked the latest photo. ` : ""}A neighbor check is extra evidence. It does not release the stocker&apos;s pay. A person approves that.</p>
        {signed ? <p className="small">You have <b className="num">{credits}</b> vending machine credits. Spend them at any of our machines.</p> : <p className="muted small">Sign in with nostr to earn vending machine credits.</p>}
        <div className="actions">
          {!signed && <button className="btn gild full" onClick={signIn}>Sign in with nostr</button>}
          <button className={"btn full" + (signed ? " gild" : "")} onClick={() => act({ action: "verify" })} disabled={busy || !p.hasPhoto}>Verify this machine is stocked</button>
          <button className="btn full" onClick={() => setOpen(open === "report" ? "" : "report")}>Report a problem</button>
          <button className="btn full" onClick={() => { document.getElementById("tip")?.scrollIntoView({ behavior: "smooth" }); }}>Tip the stocker</button>
          <button className="btn full" onClick={() => setOpen(open === "request" ? "" : "request")}>Request items</button>
        </div>
        {open === "report" && (
          <div className="form" style={{ gridTemplateColumns: "1fr" }}>
            <label><span>What is wrong</span><select value={reason} onChange={(e) => setReason(e.target.value)}>{REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label><span>Tell us more (optional)</span><textarea rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} /></label>
            <button className="btn gild" onClick={() => act({ action: "report", reason, text }, () => { setOpen(""); setText(""); })} disabled={busy}>Send the report</button>
          </div>
        )}
        {open === "request" && (
          <div className="form" style={{ gridTemplateColumns: "1fr" }}>
            <label><span>What would you like in this machine?</span><textarea rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hot chips, protein bars, juice for kids" /></label>
            <button className="btn gild" onClick={() => act({ action: "request", text }, () => { setOpen(""); setText(""); })} disabled={busy}>Send the request</button>
          </div>
        )}
      </section>

      <section className="glass tile">
        <h2>Tag and share</h2>
        <p className="muted small">Post it with the machine&apos;s tag: <span className="mono">{SHARE_TAGS(p.machine)}</span>. Sharers earn {`vending machine credits`}, once a day for each machine.</p>
        <div className="actions"><button className="btn gild full" onClick={share} disabled={busy}>Share on nostr</button><button className="btn full" onClick={() => copy(SHARE_TAGS(p.machine), "Tags copied.")}>Copy the tags</button></div>
      </section>
      {msg && <p className="toast" role="status">{msg}</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </>
  );
}
