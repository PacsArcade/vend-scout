"use client";
import { useState } from "react";
import Link from "next/link";

interface Item { id: string; item: string; status: string; priceSats: number; qty: number; machine: string }

export function MyListings() {
  const [ln, setLn] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");
  async function find(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/mylistings?ln=" + encodeURIComponent(ln));
    const j = (await r.json()) as { ok: boolean; items?: Item[]; error?: string };
    if (!j.ok) { setItems(null); setErr(j.error ?? "That did not work"); return; }
    setItems(j.items ?? []);
  }
  return (
    <>
      <form className="searchrow" onSubmit={find}>
        <input value={ln} onChange={(e) => setLn(e.target.value)} placeholder="you@wallet.example" aria-label="Your Lightning address" />
        <button className="btn gild" type="submit">Find</button>
      </form>
      <p className="muted small">No account. Type the Lightning address you listed with. We will never ask for your seed words or keys.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {items && (items.length === 0 ? <p className="muted">No listings for that address.</p> : (
        <table><tbody>{items.map((i) => <tr key={i.id}><td><Link href={`/shelf/${i.id}`}>{i.item}</Link><br /><span className="muted small">{i.machine}</span></td><td><span className={`chip st-${i.status}`}>{i.status}</span></td><td className="r num">{i.priceSats.toLocaleString("en-US")} sats<br /><span className="muted small">{i.qty} left</span></td></tr>)}</tbody></table>
      ))}
    </>
  );
}
