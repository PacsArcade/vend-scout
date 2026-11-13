// The text a crew member signs to prove they hold the crew key. No imports, so a browser component can use it.
// Kind 27002: the NIP-01 ephemeral range (20000 to 29999). Relays do not keep ephemeral events, which fits: this event is
// never published to a relay. The crew member's browser signs it and sends it only to our server, which checks it and discards it
// (only the code and the event id are kept, to stop a second use). 27001 is the rent approval; 27002 is the next free number.
export const VERIFY_KIND = 27002;
/** A code lives this long, in seconds. */
export const VERIFY_WINDOW_S = 120;
export const verifyContent = (targetHex: string, code: string) => `VEND-VERIFY|${targetHex}|${code}`;
export const verifyUnsigned = (targetHex: string, code: string, now = Date.now()) => ({
  kind: VERIFY_KIND, created_at: Math.floor(now / 1000), tags: [["p", targetHex], ["code", code]], content: verifyContent(targetHex, code),
});
