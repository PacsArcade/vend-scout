/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiVerdict, Tri } from "@/lib/types";

export interface ProofView { id: string; title: string; who: string; before: string; after: string; ticked: string[]; loadTotal: number; sentStamp: string; resent: boolean; ai: AiVerdict | null }

const cls = (t: Tri) => (t === "yes" ? "ok" : t === "no" ? "no" : "un");

export function ProofReview({ p }: { p: ProofView }) {
  const router = useRouter();
  const [glass, setGlass] = useState(p.ai?.glassClean === "yes");
  const [load, setLoad] = useState(p.ai?.loadMatches === "yes");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(decision: "approve" | "retake") {
    setBusy(true); setErr("");
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reviewProof", id: p.id, decision, reason, glassClean: glass, loadMatches: load }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not work");
    router.refresh();
  }
  return (
    <div className="glass proofcard">
      <b>{p.title}</b>
      <span className="muted small">{p.who} · <span className="mono">{p.sentStamp}</span>{p.resent ? " · retake" : ""}</span>
      <div className="proofpics">
        <figure><img src={`/api/stopphoto/${p.before}`} alt="Glass before" /><figcaption>Before</figcaption></figure>
        <figure><img src={`/api/stopphoto/${p.after}`} alt="Glass after" /><figcaption>After</figcaption></figure>
        <figure><div className="tick">{p.loadTotal === 0 ? "No load list" : `${p.ticked.length} of ${p.loadTotal} ticked: ${p.ticked.join(", ") || "none"}`}</div><figcaption>Load list</figcaption></figure>
      </div>
      <div className="aipanel" aria-label="AI check">
        <b>AI check <span className="muted small">(a suggestion, a person decides)</span></b>
        {!p.ai ? <span className="muted">Still running. Refresh in a minute.</span> : (<>
          <span>Verdict: <b>{p.ai.overall === "pass" ? "Looks good" : "Needs a person"}</b></span>
          {p.ai.slots.map((s) => <span key={s.slot}>{s.slot} {s.expected_item}: <span className={cls(s.looks_stocked)}>stocked {s.looks_stocked}</span>, <span className={cls(s.matches_item)}>right item {s.matches_item}</span></span>)}
          <span>Glass clean: <span className={cls(p.ai.glassClean)}>{p.ai.glassClean}</span></span>
          {p.ai.reasons.map((r, i) => <span key={i} className="muted">{r}</span>)}
          <span className="muted small">{p.ai.model}, {(p.ai.ms / 1000).toFixed(1)} s{p.ai.error ? `, ${p.ai.error}` : ""}</span>
        </>)}
      </div>
      <label className="check small"><input type="checkbox" checked={glass} onChange={(e) => setGlass(e.target.checked)} /> <span>The glass looks clean{p.ai?.glassClean === "yes" && <span className="suggest">AI suggests</span>}</span></label>
      <label className="check small"><input type="checkbox" checked={load} onChange={(e) => setLoad(e.target.checked)} /> <span>The load list matches the photos{p.ai?.loadMatches === "yes" && <span className="suggest">AI suggests</span>}</span></label>
      <button className="btn gild" onClick={() => go("approve")} disabled={busy}>Approve</button>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for a retake" aria-label="Reason for a retake" className="reasonin" />
      <button className="btn" onClick={() => go("retake")} disabled={busy}>Ask for a retake</button>
      {err && <span className="err" role="alert">{err}</span>}
    </div>
  );
}
