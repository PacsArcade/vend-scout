"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NEVER_SPEED_LINE } from "@/lib/gig";

export interface PointsView { me: string; total: number; level: number; name: string; next: number | null; nextName: string | null; pct: number; badges: { id: string; name: string; note: string; got: boolean }[]; streak: number; board: boolean }

export function PointsPanel(p: PointsView) {
  const router = useRouter();
  return (
    <div className="glass tile arcadepanel">
      <div className="muted small">Your score</div>
      <div className="scorebig num">{p.total.toLocaleString("en-US")}</div>
      <div className="levelrow"><span className="chip">Level {p.level}: {p.name}</span>{p.streak > 1 && <span className="chip">{p.streak} days in a row</span>}</div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct}><i style={{ width: `${p.pct}%` }} /></div>
      <p className="muted small num">{p.next !== null ? `${(p.next - p.total).toLocaleString("en-US")} points to ${p.nextName}` : "Top level reached"}</p>
      <div className="badges">{p.badges.map((b) => <span key={b.id} className={"badge" + (b.got ? " got" : "")} title={b.note}>{b.name}</span>)}</div>
      <p className="muted small">Points come from how well you fill: every slot, clean glass, before sell-out, local shelf, your own block, a clean route. {NEVER_SPEED_LINE}</p>
      <label className="check muted small"><input type="checkbox" checked={p.board} onChange={async (e) => { await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setLeaderboard", id: p.me, on: e.target.checked }) }); router.refresh(); }} /> <span>Show me on the city leaderboard (first name and last initial)</span></label>
      <div className="actions"><Link className="btn full" href={`/work/leaderboard?crew=${p.me}`}>City leaderboard</Link></div>
    </div>
  );
}
