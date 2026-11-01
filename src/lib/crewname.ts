// Crew name helpers that are safe in the browser: no secrets, no network. The server side is subname.ts.
export const NAME_RULES = "3 to 20 letters, numbers or hyphens. No hyphen at the start or end.";
export const SECRET_ENV_NAME = "FRENS_SUBNAME_SECRET_VEND";
export const OFF_LINE = `Crew names are off (${SECRET_ENV_NAME} not set)`;
export const ANCHORED_LINE = "On-chain, stays theirs";
/** Turn what someone typed into a name that fits the rules, or "" when nothing usable is left. "Maria G." becomes "maria-g". */
export function slugCrewName(input: string): string {
  const s = String(input ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20).replace(/-+$/g, "");
  return s;
}
export const validCrewName = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9]$/.test(s);
/** What the person will be called, for the live preview and the card. */
export const handleOf = (name: string) => `${name}.vend@frens`;
