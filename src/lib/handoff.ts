// Typed hand-off from the frens.earth shop to a machine pickup slot.
// v0 mocks this: nothing here calls a frens.earth API. The order is typed in by hand on /orders.
export const SHOP_URL = "https://frens.earth/store";

export interface MerchHandoff {
  source: "frens.earth";
  orderRef: string; // the shop's own order reference
  itemName: string;
  priceSats: number;
  machineId: string;
}
// TODO: when the shop exposes a signed hand-off (webhook or order lookup), build it here.
// Until then this app trusts whatever is typed into the form. Do not call the shop from this file.
