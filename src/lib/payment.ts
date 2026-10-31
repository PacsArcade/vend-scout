// PaymentRail: the seam where a real Lightning rail plugs in.
// v0 ships a stub only. No wallet, no keys, no network.
// TODO: LNbits Bitcoin Switch, see https://github.com/lnbits/bitcoinswitch
//       Read its README for the real invoice and relay flow before writing an adapter.
// TODO: BTCPay, for the pickup-order checkout on the shop side.

export interface InvoiceRequest { machineId: string; slot: string; amountSats: number; memo?: string }
export interface Invoice {
  id: string;
  bolt11: string; // placeholder text in the stub
  amountSats: number;
  testMode: boolean;
  expiresAt: string;
}
export type PaymentStatus = "pending" | "paid" | "expired";

export interface PaymentRail {
  name: string;
  createInvoice(req: InvoiceRequest): Promise<Invoice>;
  status(invoiceId: string): Promise<PaymentStatus>;
  // TODO: dispense(machineId, slot) once a board (relay) is wired in.
}

export const stubRail: PaymentRail = {
  name: "stub",
  async createInvoice(req) {
    const id = `test-${req.machineId}-${req.slot}`;
    return {
      id,
      bolt11: `lntb${req.amountSats}n1TESTMODE${req.machineId}${req.slot}NOTAREALINVOICE`,
      amountSats: req.amountSats,
      testMode: true,
      expiresAt: "never (test)",
    };
  },
  async status() {
    return "pending";
  },
};

export const rail: PaymentRail = stubRail;
