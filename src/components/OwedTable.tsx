import { bftDatePlain } from "@/lib/bft";
import { NOT_SENT, type OwedLine } from "@/lib/rent";
import { RentApprove } from "./RentApprove";

const STATE_TEXT: Record<OwedLine["state"], string> = { accruing: "Period still open", "needs address": "Needs a Lightning address", ready: "Ready to pay", approved: NOT_SENT };
const sats = (n: number) => `${n.toLocaleString("en-US")} sats`;

/** Owed rent lines. The operator view has the sign-and-approve button. The owner view only reads. No button here pays anything. */
export function OwedTable({ lines, operator, cap }: { lines: OwedLine[]; operator: boolean; cap?: number }) {
  if (lines.length === 0) return <p className="muted">No rent lines yet. A line appears once a machine has an owner and rent terms.</p>;
  return (
    <div className="owedlist">
      {lines.map((l) => (
        <div key={l.id} className="owedline">
          <div className="o-mach"><b>{l.machineName}</b>{operator && <div className="muted small brk">{l.owner.slice(0, 14)}...{l.owner.slice(-6)}</div>}</div>
          <div className="o-per"><span className="mono small">{l.fromH.toLocaleString("en-US")} to {(l.toH - 1).toLocaleString("en-US")}</span><div className="muted small">{bftDatePlain(l.fromH)} to {bftDatePlain(l.toH - 1)} a₿</div></div>
          <div className="o-sales num">{sats(l.salesSats)}<div className="muted small">{l.salesCount} sale{l.salesCount === 1 ? "" : "s"}</div></div>
          <div className="o-owed num">{l.state === "accruing" ? <span className="muted">not final</span> : <b>{sats(l.sats)}</b>}{l.state !== "accruing" && <div className="muted small">{l.flatSats ? `${sats(l.flatSats)} flat` : ""}{l.flatSats && l.percentSats ? " + " : ""}{l.percentSats ? `${sats(l.percentSats)} of sales` : ""}</div>}</div>
          {operator && <div className="o-pay brk small"><span className="muted">Pay to </span>{l.address || <span className="muted">none on file</span>}</div>}
          <div className="o-state">
            <span className={"chip" + (l.state === "approved" ? " good" : "")}>{STATE_TEXT[l.state]}</span>
            {l.staleApproval && <div className="muted small">A past approval no longer matches this line.</div>}
            {operator && l.state === "ready" && (cap === undefined || l.sats <= cap) && <div style={{ marginTop: 6 }}><RentApprove line={l} label="Approve with my signer" /></div>}
            {operator && l.state === "ready" && cap !== undefined && l.sats > cap && <div className="err small">Over the {cap.toLocaleString("en-US")} sat cap. Raise the cap on the server to approve.</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
