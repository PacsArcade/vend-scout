"use client";
import { useState } from "react";
import { ActionForm } from "./Actions";
import { MiniMap, type MapPoint } from "./MiniMap";
import { APPLICANT_STAGES, CREW_ROLES, type ApplicantStage, type CrewRole } from "@/lib/types";
import { ROLE_COPY } from "@/lib/crew";

export interface ApplicantView {
  id: string; name: string; reach: string; area: string; lat?: number; lon?: number; roles: CrewRole[]; transport: string[]; hours: string; why: string; lightning?: string;
  stage: ApplicantStage; npub?: string; stamp: string; notes: { stage: string; text: string; stamp: string }[];
}

export function ApplicantsBoard({ applicants, machines, center }: { applicants: ApplicantView[]; machines: { id: string; name: string; lat: number; lon: number }[]; center: [number, number] }) {
  const [role, setRole] = useState("");
  const [area, setArea] = useState("");
  const shown = applicants.filter((a) => (!role || a.roles.includes(role as CrewRole)) && (!area || a.area.toLowerCase().includes(area.toLowerCase())));
  const points: MapPoint[] = [
    ...machines.map((m) => ({ id: "m" + m.id, lat: m.lat, lon: m.lon, kind: "machine" as const, label: `Machine: ${m.name}` })),
    ...shown.filter((a) => a.lat !== undefined && a.lon !== undefined).map((a) => ({ id: a.id, lat: a.lat!, lon: a.lon!, kind: "applicant" as const, label: `${a.name}, ${a.area}` })),
  ];
  return (
    <>
      <div className="glass card">
        <div className="searchrow">
          <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} className="selbox">
            <option value="">All roles</option>
            {CREW_ROLES.map((r) => <option key={r} value={r}>{ROLE_COPY[r].title}</option>)}
          </select>
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Filter by area" aria-label="Filter by area" />
        </div>
        <p className="muted small">{shown.length} of {applicants.length} applicants. Gold dots are applicants, green dots are placed machines.</p>
        <MiniMap points={points} center={center} zoom={10} label="Applicants and placed machines" />
      </div>
      {applicants.length === 0 ? (
        <div className="glass card"><h2>No applicants yet</h2><p className="muted">They show up here when someone sends the form on the Crew page.</p></div>
      ) : (
        <div className="pipeboard">
          {APPLICANT_STAGES.map((st) => {
            const col = shown.filter((a) => a.stage === st);
            return (
              <div key={st} className="pipecol">
                <h3><span>{st}</span><span className="muted num">{col.length}</span></h3>
                {col.map((a) => (
                  <div key={a.id} className="glass applicant">
                    <div className="nm">{a.name}</div>
                    <div className="muted">{a.roles.map((r) => ROLE_COPY[r].title).join(", ")}</div>
                    <div>{a.area}{a.transport.length ? ` · ${a.transport.join(", ")}` : ""}</div>
                    <div className="brk">{a.reach}{a.lightning ? ` · ${a.lightning}` : ""}</div>
                    {a.hours && <div className="muted">Hours: {a.hours}</div>}
                    {a.why && <div className="muted">&ldquo;{a.why}&rdquo;</div>}
                    <div className="muted small brk">{a.npub ? `npub: ${a.npub.slice(0, 14)}...${a.npub.slice(-6)}` : "No npub linked"}</div>
                    <div className="muted mono stamp">Applied {a.stamp}</div>
                    {a.notes.map((n, i) => <div key={i} className="stepnote"><span className="muted">{n.stage}</span> · {n.text}<br /><span className="muted mono stamp">{n.stamp}</span></div>)}
                    {!a.npub && <ActionForm action="attachNpub" extra={{ id: a.id }} submit="Link npub" doneText="Linked." fields={[{ name: "npub", label: "Link their npub", placeholder: "npub1..." }]} />}
                    <ActionForm action="applicantStep" extra={{ id: a.id }} submit="Save step" doneText="Saved." fields={[
                      { name: "stage", label: "Move to", type: "select", value: a.stage, options: APPLICANT_STAGES.map((s) => ({ value: s, label: s })) },
                      { name: "note", label: "Note", optional: true, placeholder: "What happened?" },
                    ]} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
