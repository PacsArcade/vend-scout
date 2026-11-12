import { ActionForm } from "./Actions";
import { RENT_PREF_LABEL, HOST_STAGES, type HostApp, type HostStage } from "@/lib/types";

export interface HostView { app: HostApp; stamp: string; notes: { stage: string; text: string; stamp: string }[] }
const stepStages = HOST_STAGES.filter((s) => s !== "Approved");

/** The operator's stage list for owner applications. Approving links a machine and sets rent terms. */
export function HostApps({ views, machines }: { views: HostView[]; machines: { id: string; name: string; owner: boolean }[] }) {
  if (views.length === 0) return <div className="glass card"><h2>No owner applications yet</h2><p className="muted">They show up here when someone sends the form at /owner/apply.</p></div>;
  return (
    <div className="pipeboard">
      {HOST_STAGES.map((st: HostStage) => {
        const col = views.filter((v) => v.app.stage === st);
        return (
          <div key={st} className="pipecol">
            <h3><span>{st}</span><span className="muted num">{col.length}</span></h3>
            {col.map(({ app: a, stamp, notes }) => (
              <div key={a.id} className="glass applicant">
                <div className="nm">{a.business}</div>
                <div>{a.address}{a.area ? ` (${a.area})` : ""}</div>
                <div className="brk">{a.contactName ? `${a.contactName} · ` : ""}{a.contact}</div>
                <div className="muted">{a.wantsHost ? "Wants a machine hosted" : "Not asking for a machine"} · rent: {RENT_PREF_LABEL[a.rentPref]}</div>
                {a.rentNote && <div className="muted">&ldquo;{a.rentNote}&rdquo;</div>}
                <div className="brk">Pays to {a.payout}</div>
                <div className="muted small">{a.payoutSource === "profile" ? "Their browser says this came from their nostr profile (not checked here)." : "Typed in by them."}</div>
                <div className="muted small brk">{a.npub.slice(0, 14)}...{a.npub.slice(-6)}</div>
                <div className="muted mono stamp">Applied {stamp}</div>
                {notes.map((n, i) => <div key={i} className="stepnote"><span className="muted">{n.stage}</span> · {n.text}<br /><span className="muted mono stamp">{n.stamp}</span></div>)}
                {a.stage !== "Approved" && (
                  <>
                    <ActionForm action="hostStep" extra={{ id: a.id }} submit="Save step" doneText="Saved." fields={[
                      { name: "stage", label: "Move to", type: "select", value: a.stage, options: stepStages.map((s) => ({ value: s, label: s })) },
                      { name: "note", label: "Note", optional: true, placeholder: "What happened?" },
                    ]} />
                    <ActionForm action="approveHost" extra={{ id: a.id }} submit="Approve and link machine" doneText="Approved." fields={[
                      { name: "machine", label: "Machine", type: "select", options: machines.map((m) => ({ value: m.id, label: m.name + (m.owner ? " (has an owner)" : "") })) },
                      { name: "flatSats", label: "Flat rent, sats per period", type: "number", value: 0, min: 0 },
                      { name: "percent", label: "Percent of sales", type: "number", value: 0, min: 0, max: 100 },
                      { name: "periodBlocks", label: "Period in blocks (4,320 is about a month)", type: "number", value: 4320, min: 144 },
                    ]} />
                  </>
                )}
                {a.stage === "Approved" && a.machine && <div className="muted small">Linked to machine {machines.find((m) => m.id === a.machine)?.name ?? a.machine}.</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
