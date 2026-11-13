// The text an operator signs to approve one owed line. No imports, so a browser component can use it.
export const RENT_APPROVAL_KIND = 27001; // custom kind, never published; the operator's browser signs it and the server checks it
type L = { id: string; sats: number; address: string };
/** The exact text signed for one line. Any change to the line, amount or address changes it. */
export const approvalContent = (l: L) => `VEND-RENT-APPROVE|${l.id}|${l.sats}|${l.address}`;
export const approvalUnsigned = (l: L, now = Date.now()) => ({ kind: RENT_APPROVAL_KIND, created_at: Math.floor(now / 1000), tags: [["d", l.id]], content: approvalContent(l) });
