// Shape check for a Lightning address (user@domain) or an LNURL. This only looks at the text.
// It never contacts the domain, and it refuses anything that looks like a seed phrase or a key.
export function validLightning(input: string): { ok: boolean; value: string; error?: string } {
  const v = input.trim();
  if (!v) return { ok: false, value: v, error: "A Lightning address is needed" };
  if (v.split(/\s+/).length >= 6) return { ok: false, value: v, error: "That looks like seed words. Never type those here. We only need a Lightning address like you@wallet.example" };
  if (/^(xprv|yprv|zprv|nsec1|lnbc|lntb|ln[a-z]*1.*invoice)/i.test(v) && !/^lnurl1/i.test(v)) return { ok: false, value: v, error: "That looks like a key or an invoice. We only need a Lightning address or an LNURL" };
  if (/^[0-9a-f]{64}$/i.test(v)) return { ok: false, value: v, error: "That looks like a private key. Never type one here" };
  if (/^[a-z0-9._+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(v)) return { ok: true, value: v.toLowerCase() };
  if (/^lnurl1[02-9ac-hj-np-z]{20,}$/i.test(v)) return { ok: true, value: v.toLowerCase() };
  return { ok: false, value: v, error: "Use a Lightning address like you@wallet.example, or an LNURL" };
}
