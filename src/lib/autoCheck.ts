import type { Proof } from "./types";

// The seam for an automatic proof check later (a vision model, or the machine's own sensors).
// "pass" means the proof can be approved without a person. "needs-human" sends it to the admin queue.
// v0 stub: every proof needs a human.
export type CheckResult = "pass" | "needs-human";
export function autoCheck(_proof: Pick<Proof, "before" | "after" | "ticked" | "loadTotal">): CheckResult {
  return "needs-human";
}
