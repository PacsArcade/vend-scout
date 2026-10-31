// Payout: how sats would reach a maker or a crew member. v0 has a stub that sends nothing.
// No wallet, no keys, no network. TODO: plug in a real rail (LNbits, see github.com/lnbits) behind this interface.
export interface PayoutRequest { to: string; sats: number; reason: string }
export interface Payout {
  name: string;
  send(req: PayoutRequest): Promise<{ id: string; sent: boolean; note: string }>;
}
export const stubPayout: Payout = {
  name: "stub (nothing is sent)",
  async send(req) { return { id: `test-${Date.now()}`, sent: false, note: `Test only. Would pay ${req.sats} sats to ${req.to} for ${req.reason}.` }; },
};
export const payout: Payout = stubPayout;
