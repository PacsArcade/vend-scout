"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RunJob } from "./RunJob";

export interface ClaimView { job: string; by: string; title: string; sats: number; stamp: string; done: boolean; doneStamp?: string; lat?: number; lon?: number; lightning?: string }
export interface RouteView { id: string; name: string; runner: string; stops: number; logged: number }

export function MyWork({ crew, claims, routes, initial }: { crew: { id: string; name: string }[]; claims: ClaimView[]; routes: RouteView[]; initial?: string }) {
  const [me, setMe] = useState(initial ?? "");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!initial) setMe(localStorage.getItem("vs-me") ?? ""); }, [initial]);
  const mine = claims.filter((c) => c.by === me);
  const myRoutes = routes.filter((r) => r.runner === me);
  const total = mine.filter((c) => c.done).reduce((a, c) => a + c.sats, 0);
  return (
    <>
      <label className="runpick"><span>I am</span>
        <select value={me} onChange={(e) => { setMe(e.target.value); localStorage.setItem("vs-me", e.target.value); }}>
          <option value="">Pick your name</option>
          {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {!me && <p className="muted">Pick your name to see the jobs you claimed.</p>}
      {me && mine.length === 0 && myRoutes.length === 0 && <div className="glass tile"><b>Nothing claimed yet</b><p className="muted small">Claim a job on the Open jobs board.</p><div className="actions"><Link className="btn gild full" href="/jobs">Open jobs</Link></div></div>}
      {myRoutes.map((r) => (
        <div key={r.id} className="glass tile">
          <div className="muted small">Route</div><h2>{r.name}</h2>
          <p className="muted small">{r.logged} of {r.stops} stops logged</p>
          <div className="actions"><Link className="btn gild full" href={`/run/${r.id}`}>Open the route</Link></div>
        </div>
      ))}
      {mine.map((c) => (
        <div key={c.job} className={"glass tile" + (c.done ? " donecard" : "")}>
          <div className="muted small">{c.done ? `Done ${c.doneStamp}` : `Claimed ${c.stamp}`}</div>
          <h2>{c.title}</h2>
          <p className="num">{c.sats.toLocaleString("en-US")} sats{c.lightning ? ` to ${c.lightning}` : ""}</p>
          {!c.done && c.lat !== undefined && <div className="actions"><a className="btn full" href={`https://www.openstreetmap.org/directions?route=%3B${c.lat}%2C${c.lon}`} target="_blank" rel="noopener noreferrer">Directions</a></div>}
          {!c.done && <RunJob job={c.job} />}
        </div>
      ))}
      {me && total > 0 && <p className="muted small num">Jobs done: {mine.filter((c) => c.done).length}. Earned so far: {total.toLocaleString("en-US")} sats (test, nothing is paid yet).</p>}
    </>
  );
}
