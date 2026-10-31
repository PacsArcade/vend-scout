import { cookies } from "next/headers";
import { crewFor } from "./crewauth";
import { CREW_COOKIE, crewPubkeyFromCookieHeader, gateOn } from "./operator";
import { isOperatorNow } from "./auth";
import { readState } from "./store";
import type { Applicant } from "./types";

export interface Who { gate: boolean; operator: boolean; crew: Applicant | null }
/** Server components: who is looking. When the gate is off (local dev) everyone is operator and the name picker stays. */
export async function whoAmI(): Promise<Who> {
  const operator = await isOperatorNow();
  if (!gateOn()) return { gate: false, operator: true, crew: null };
  let crew: Applicant | null = null;
  try {
    const hex = crewPubkeyFromCookieHeader(`${CREW_COOKIE}=${(await cookies()).get(CREW_COOKIE)?.value ?? ""}`);
    if (hex) crew = crewFor((await readState()).applicants, hex);
  } catch { crew = null; }
  return { gate: true, operator, crew };
}
/** The crew id a crew page should use: a signed-in crew member is always themselves; operators and local dev may pick with ?crew=. */
export async function resolveCrewId(param: string | undefined): Promise<{ id: string | undefined; who: Who }> {
  const who = await whoAmI();
  if (who.gate && !who.operator) return { id: who.crew?.id, who };
  return { id: param, who };
}
