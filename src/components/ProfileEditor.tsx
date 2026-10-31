"use client";
import { useState } from "react";
import { MachineForm } from "./MachineForm";
import type { MachineProfile } from "@/lib/types";

export function ProfileEditor({ machineId, initial }: { machineId: string; initial: MachineProfile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="edit">
      <div className="actions"><button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Close the editor" : "Edit the profile"}</button></div>
      {open && <MachineForm mode="edit" machineId={machineId} initial={initial} />}
    </div>
  );
}
