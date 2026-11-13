import { crewPubkeyFromCookieHeader, neighborFromCookieHeader, operatorFromCookieHeader } from "./operator";

/** The nostr key a request signed in as, from any of the three signed cookies (crew, neighbor, operator). Null when none. */
export function sessionKeyFromCookies(header: string | null): string | null {
  for (const f of [crewPubkeyFromCookieHeader, neighborFromCookieHeader, operatorFromCookieHeader]) {
    try { const k = f(header); if (k) return k; } catch { /* secret not set: try the next */ }
  }
  return null;
}
