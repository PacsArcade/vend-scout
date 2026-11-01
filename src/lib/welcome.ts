import { sendWelcomeDm, welcomeText, type DmResult } from "./dm";
import { openJobs } from "./jobs";
import { npubToHex } from "./operator";
import { handleOf } from "./subname";
import { perform, readState } from "./store";

/** Compose and send the welcome DM for one crew member, log it, and hand back the text so the app can show it. */
export async function welcomeDmFor(applicantId: string, origin: string, force = false): Promise<DmResult & { hasKey: boolean; already?: boolean }> {
  const st = await readState();
  const a = st.applicants.find((x) => x.id === applicantId);
  if (!a) return { sent: false, skipped: "no such person", text: "", hasKey: false };
  const hex0 = a.npub ? npubToHex(a.npub) : null;
  const prior = hex0 ? st.dms.filter((d) => d.to === hex0 && d.sent).pop() : undefined;
  // Only the first sign-in sends. "Resend the DM" sends again on purpose.
  if (prior && !force) return { sent: true, text: prior.text, hasKey: true, already: true };
  const first = (await openJobs(st)).jobs[0];
  const text = welcomeText({ name: a.name, jobTitle: first?.title, sats: first ? first.sats + first.bonus : undefined, url: `${origin}/jobs`, crewHandle: a.crewNameState?.status === "seated" ? handleOf(a.crewNameState.name) : undefined });
  const hex = a.npub ? npubToHex(a.npub) : null;
  const r: DmResult = hex ? await sendWelcomeDm(hex, text) : { sent: false, skipped: "no nostr key on the application", text };
  await perform({ action: "logDm", to: hex ?? a.id, text, sent: r.sent, reason: r.skipped });
  return { ...r, hasKey: r.skipped !== "dm skipped: no sender key" };
}
