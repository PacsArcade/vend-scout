import { nip19 } from "nostr-tools";
import { validLightning } from "./lightning";
import { npubToHex } from "./operator";
import type { HostApp, RentPref } from "./types";

// An owner (host) application. Pure checks, used by the store. The server never reads relays: whether the address came from the nostr profile is what the browser says.
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "");
export interface HostInput { business?: unknown; address?: unknown; area?: unknown; lat?: unknown; lon?: unknown; contactName?: unknown; contact?: unknown; wantsHost?: unknown; rentPref?: unknown; rentNote?: unknown; payout?: unknown; payoutSource?: unknown }

export function cleanHostApp(i: HostInput, keyHex: string, existing: HostApp[]): { ok: true; app: Omit<HostApp, "id" | "stage" | "notes" | "createdAt" | "h"> } | { ok: false; error: string } {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) return { ok: false, error: "Sign in with nostr first" };
  if (existing.some((a) => npubToHex(a.npub) === keyHex && a.stage !== "Not now")) return { ok: false, error: "You already have an application in. We will be in touch" };
  const business = clip(i.business, 100), address = clip(i.address, 200), contact = clip(i.contact, 120);
  if (!business) return { ok: false, error: "What is the business or location called?" };
  if (!address && !clip(i.area, 100)) return { ok: false, error: "Add the address or pick the place" };
  if (!contact.includes("@") && contact.replace(/\D/g, "").length < 7) return { ok: false, error: "Give an email or a phone number we can use" };
  const ln = validLightning(String(i.payout ?? ""));
  if (!ln.ok) return { ok: false, error: ln.error ?? "Add a Lightning address for rent" };
  const pref: RentPref = (["flat", "percent", "both", "open"] as const).includes(i.rentPref as RentPref) ? (i.rentPref as RentPref) : "open";
  const lat = Number(i.lat), lon = Number(i.lon);
  const ok = i.lat !== undefined && i.lat !== null && i.lat !== "" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return { ok: true, app: { npub: nip19.npubEncode(keyHex), business, address, area: clip(i.area, 100) || undefined, lat: ok ? lat : undefined, lon: ok ? lon : undefined, contactName: clip(i.contactName, 80), contact, wantsHost: i.wantsHost !== false, rentPref: pref, rentNote: clip(i.rentNote, 400), payout: ln.value, payoutSource: i.payoutSource === "profile" ? "profile" : "entered", machine: undefined } };
}
