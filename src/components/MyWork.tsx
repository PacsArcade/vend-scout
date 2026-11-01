"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PopHost, type PopView } from "./PopHost";
import { ProofUpload, type LoadItem } from "./ProofUpload";
import { NEVER_SPEED_LINE } from "@/lib/gig";

export interface ClaimView {
  job: string; by: string; title: string; sats: number; stamp: string; done: boolean; doneStamp?: string; lat?: number; lon?: number; lightning?: string;
  proof?: { status: "sent" | "retake" | "approved"; reason?: string; points?: number }; loadList: LoadItem[];
}
export interface RouteView { id: string; name: string; runner: string; stops: number; logged: number }

export function MyWork({ crew, claims, routes, initial, pops, locked }: { crew: { id: string; name: string }[]; claims: ClaimView[]; routes: RouteView[]; initial?: string; pops: PopView[]; locked?: boolean }) {
  const [me, setMe] = useState(initial ?? "");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!initial) setMe(localStorage.getItem("vs-me") ?? ""); }, [initial]);
  const mine = claims.filter((c) => c.by === me);
  const myRoutes = routes.filter((r) => r.runner === me);
  const total = mine.filter((c) => c.done).reduce((a, c) => a + c.sats, 0);
  return (
    <>
      {!locked && <label className="runpick"><span>I am</span>
        <select value={me} onChange={(e) => { setMe(e.target.value); localStorage.setItem("vs-me", e.target.value); }}>
          <option value="">Pick your name</option>
          {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>}
      {locked && !me && <p><Link className="btn gild full" href="/crew/signin?next=/run">Sign in with nostr</Link></p>}
      {me && <PopHost pops={pops} me={me} />}
      {!me && !locked && <p className="muted">Pick your name to see the jobs you claimed.</p>}
      {me && mine.length === 0 && myRoutes.length === 0 && <div className="glass tile"><b>Nothing claimed yet</b><p className="muted small">Claim a job on the Open jobs board.</p><div className="actions"><Link className="btn gild full" href="/jobs">Open jobs</Link></div></div>}
      {myRoutes.map((r) => (
        <div key={r.id} className="glass tile">
          <div className="muted small">Route</div><h2>{r.name}</h2>
          <p className="muted small">{r.logged} of {r.stops} stops paid</p>
          <div className="actions"><Link className="btn gild full" href={`/run/${r.id}`}>Open the route</Link></div>
        </div>
      ))}
      {mine.map((c) => (
        <div key={c.job} className={"glass tile" + (c.done ? " donecard" : "")}>
          <div className="muted small">{c.done ? `Paid ${c.doneStamp}` : `Claimed ${c.stamp}`}</div>
          <h2>{c.title}</h2>
          <p className="num">{c.sats === 0 ? "Paid in parts" : `${c.sats.toLocaleString("en-US")} sats`}{c.lightning ? ` to ${c.lightning}` : ""}</p>
          {c.done && <span className="pstate paid">Paid{c.proof?.points ? `, +${c.proof.points} points` : ""}</span>}
          {!c.done && c.proof?.status === "sent" && <span className="pstate sent">Proof sent</span>}
          {!c.done && c.proof?.status === "retake" && <span className="pstate retake">Retake asked</span>}
          {!c.done && c.lat !== undefined && <div className="actions"><a className="btn full" href={`https://www.openstreetmap.org/directions?route=%3B${c.lat}%2C${c.lon}`} target="_blank" rel="noopener noreferrer">Directions</a></div>}
          {!c.done && c.proof?.status !== "sent" && <ProofUpload kind="job" refId={c.job} loadList={c.loadList} retakeReason={c.proof?.status === "retake" ? c.proof.reason : undefined} />}
        </div>
      ))}
      {me && total > 0 && <p className="muted small num">Jobs paid: {mine.filter((c) => c.done).length}. Earned so far: {total.toLocaleString("en-US")} sats (test, nothing is sent yet).</p>}
      <p className="muted small">{NEVER_SPEED_LINE}</p>
    </>
  );
}
