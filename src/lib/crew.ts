import type { CrewRole } from "./types";
import { RATES } from "./rates";

// Copy from JOBS.md, word for word. Public text: no em dashes.
export const SHARED_LINE = "Work for yourself, with a crew behind you. Every machine we place connects a neighborhood: a place to grab a snack, a shelf for the farm down the road, a first sats payment for someone who never tried bitcoin. Be the one who builds that bridge.";

export const ROLE_COPY: Record<CrewRole, { title: string; body: string }> = {
  runner: { title: "Route Runner", body: "Pick your stops on the map, restock and wipe down the machines, snap a photo, done. Paid per stop in sats, bonus when a machine sells out between visits. Your hours, your neighborhood, your playlist." },
  scout: { title: "Place Scout", body: "You know which laundromat is packed at 10 PM. Walk your blocks with the scout map, pitch the owner with our one-page sheet, earn a finder's reward in sats for every machine that goes in." },
  keeper: { title: "Shelf Keeper", body: "The bridge to local farms and makers. Pick up honey, eggs and goods from the folks who make them, check the labels, stock the local shelf. Know your farmers by name." },
  tech: { title: "Machine Tech", body: "Fix a stuck spiral, wire a Lightning board, swap a card reader. Paid per job in sats." },
};

// Pay terms (the Admiral's ruling): independent contractors, DoorDash style, paid in sats.
// Target hourly value (the 21 nod), turned into a per-job sats rate at the day's rate.
// No other legal claims here. The only legal line is CONTRACTOR_NOTE.
// The dollar target stays behind the scenes (it sets the sats per job). It is never shown on any page or feed.
export interface PayTerms { currency: "sats"; targetUsdPerHour: number; line: string }
export const PAY_TERMS: PayTerms = { currency: "sats", targetUsdPerHour: 21, line: "Paid in sats." };
export const CONTRACTOR_NOTE = "Crew work as independent contractors. Rules differ by place; check yours.";

// Estimated minutes per job. Edit here.
export const JOB_MINUTES = { restock: 20, scout: 30, shelf: 25, tech: 45 } as const;
export const ROLE_JOB: Record<CrewRole, keyof typeof JOB_MINUTES> = { runner: "restock", scout: "scout", keeper: "shelf", tech: "tech" };
export const JOB_NOUN: Record<keyof typeof JOB_MINUTES, string> = { restock: "restock stop", scout: "machine placed", shelf: "shelf pickup", tech: "tech job" };
// Route Runner stop and Place Scout placement are flat starting rates (rates.ts). Shelf pickups and tech jobs are not ruled yet, so they keep the hourly figure.
export const satsFor = (job: keyof typeof JOB_MINUTES, satsPerUsd: number) =>
  job === "restock" ? Math.round(RATES.runnerPerStopUsd * satsPerUsd)
  : job === "scout" ? 0 // a Place Scout is paid in parts (scoutpay.ts), never by the pitch job itself
  : Math.round((PAY_TERMS.targetUsdPerHour * JOB_MINUTES[job] * satsPerUsd) / 60);
