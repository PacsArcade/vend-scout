"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Pin } from "@/lib/pins";
import type { VenueCategory } from "@/lib/types";
import { agoLine, type PayWay } from "@/lib/machinecard";
import { PayLine } from "./PayLine";
import { HexMark } from "./Hex";
import { PublicReport } from "./PublicReport";

// r23: the card a pin tap opens over the bottom of the map. Three faces, from the round 2 mockup:
// an operator's store card (facts and two buttons), the public store card (facts only), and our machine card.
// A cell holding several things at the finest grid opens a short pick list instead.

export type OursPt = { id: string; name: string; host: string; lat: number; lon: number; btc: boolean; ways: PayWay[]; stocked: string | null };
export type CardItem = { kind: "store"; pin: Pin } | { kind: "machine"; m: OursPt };
export type CardTarget = CardItem | { kind: "cell"; items: CardItem[] } | { kind: "others"; count: number; lat: number; lon: number };

const KIND: Record<VenueCategory, string> = { laundry: "Laundromat", gym: "Gym", car_wash: "Car wash", car_repair: "Auto shop" };

export const PinCard = forwardRef<HTMLDivElement, { target: CardTarget; operator: boolean; mailOn: boolean; onClose: () => void; onPick: (it: CardItem) => void }>(function PinCard({ target, operator, mailOn, onClose, onPick }, ref) {
  const head = useRef<HTMLHeadingElement>(null);
  const key = target.kind === "store" ? target.pin.id : target.kind === "machine" ? target.m.id : target.kind === "others" ? `others:${target.lat},${target.lon}` : target.items.map((i) => (i.kind === "store" ? i.pin.id : i.m.id)).join(",");
  // the machine card can turn into the report form (r23 part C), and back
  const [reporting, setReporting] = useState<string | null>(null);
  const reportOpen = target.kind === "machine" && reporting === target.m.id;
  useEffect(() => { head.current?.focus(); }, [key, reportOpen]);
  const close = <button type="button" className="x" onClick={onClose}>Close</button>;
  let body: React.ReactNode;
  if (target.kind === "store") {
    const p = target.pin;
    body = (
      <>
        <div className="hd">
          <HexMark kind="site" size={30} />
          <div><h3 id="pincard-h" ref={head} tabIndex={-1}>{p.name}</h3><p className="why">{KIND[p.category]}{p.area ? ` · ${p.area}` : ""}</p></div>
          {close}
        </div>
        {operator && <p className="fit num">Fit {p.score} of 100 {p.checked && <span className="pill pur">Scout checked</span>}</p>}
        {/* r24: the kind is said once, under the name; the chips carry only what the name line does not */}
        {(p.late || p.site) && <p className="chiprow">{p.late && <span className="chip">open late</span>}{p.site && <span className="chip">has website</span>}</p>}
        {operator
          ? <div className="acts"><Link className="btn gild" href={`/prospects/${p.id}`}>Review this site</Link><Link className="btn" href={`/prospects/${p.id}/site`}>Selling card</Link></div>
          : <p className="why">No machine here yet.</p>}
      </>
    );
  } else if (target.kind === "machine") {
    const m = target.m;
    body = (
      <>
        <div className="hd">
          <HexMark kind={m.btc ? "coin" : "machine"} size={30} tone="#00ffff" />
          <div><h3 id="pincard-h" ref={head} tabIndex={-1}>{reportOpen ? `Report a problem: ${m.name}` : m.name}</h3><p className="why">Our machine{m.host ? ` at ${m.host}` : ""}</p></div>
          {close}
        </div>
        {reportOpen ? <PublicReport machine={m.id} machineName={m.name} mailOn={mailOn} onDone={() => setReporting(null)} /> : <>
        <div className="facts">
          <div><span>Takes</span><b><PayLine ways={m.ways} lead="" /></b></div>
          <div><span>Last stocked</span><b>{m.stocked ? agoLine(m.stocked) : "No stocking photo yet"}</b></div>
        </div>
        <div className="acts">
          <button type="button" className="btn gild" onClick={() => setReporting(m.id)}>Report a problem</button>
          <Link className="btn" href={`/m/${m.id}`}>Machine page</Link>
        </div>
        <div className="acts one"><Link className="btn" href={`/vote/${m.id}`}>Vote on what goes in</Link></div>
        </>}
      </>
    );
  } else if (target.kind === "others") {
    // r24: a cell holding only other operators' machines. Facts only, no buttons.
    const n = target.count;
    body = (
      <>
        <div className="hd">
          <HexMark kind="machine" size={30} tone="#8a9bb0" />
          <div><h3 id="pincard-h" ref={head} tabIndex={-1}>{n} vending machine{n === 1 ? "" : "s"} by other operators</h3><p className="why">In this hexagon, from OpenStreetMap. Not ours: we do not stock or service {n === 1 ? "it" : "them"}.</p></div>
          {close}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="hd">
          <HexMark kind="site" size={30} />
          <div><h3 id="pincard-h" ref={head} tabIndex={-1}>{target.items.length} places in this hexagon</h3><p className="why">Pick one to see its facts.</p></div>
          {close}
        </div>
        <ul className="picks">
          {target.items.map((it) => (
            <li key={it.kind === "store" ? it.pin.id : it.m.id}>
              <button type="button" className="btn" onClick={() => onPick(it)}>{it.kind === "store" ? it.pin.name : `${it.m.name}, our machine`}</button>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return <div ref={ref} className="glass pincard" role="dialog" aria-labelledby="pincard-h"><div className="grab" aria-hidden="true" /><div className="pcscroll">{body}</div></div>;
});
