import { createHash } from "crypto";
import { readText, writeText } from "./blobstore";
import type { Contact, OsmContactTags } from "./types";

const UA = "VendScout/0.3 (Pac's Arcade; reads a business's own public contact page; pac@pacsarcade.org)";
const WEEK = 7 * 24 * 3600 * 1000;
const PAGE_MS = 10_000;
const MAX_PAGES = 3;
const MAX_BYTES = 600_000;

export interface SiteResult { url: string; fetchedAt: number; pages: string[]; contacts: Contact[]; note?: string }

export function normalizeUrl(u: string): string | null {
  let t = u.trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try {
    const x = new URL(t);
    if (!/^https?:$/.test(x.protocol) || !x.hostname.includes(".")) return null;
    x.hash = "";
    return x.toString();
  } catch {
    return null;
  }
}
const SOCIAL = /(^|\.)(facebook|instagram|fb)\.(com|me)$/i;
export const isSocialHost = (u: string) => { try { return SOCIAL.test(new URL(u).hostname); } catch { return false; } };

/** Contacts from the map's own tags. */
export function osmContacts(t: OsmContactTags): Contact[] {
  const out: Contact[] = [];
  const add = (kind: Contact["kind"], v?: string) => v && v.trim() && out.push({ kind, value: v.trim(), source: "OpenStreetMap" });
  for (const p of (t.phone ?? "").split(";")) add("phone", p);
  for (const e of (t.email ?? "").split(";")) add("email", e);
  add("website", t.website);
  add("facebook", t.facebook);
  add("instagram", t.instagram);
  return out;
}

// ---- robots.txt ----
interface Rules { disallow: string[]; allow: string[] }
export function parseRobots(txt: string): Rules {
  // Use the group naming our project if there is one, else the * group.
  const groups: { agents: string[]; dis: string[]; allow: string[] }[] = [];
  let cur: { agents: string[]; dis: string[]; allow: string[] } | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], dis: [], allow: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else if (cur) {
      lastWasAgent = false;
      if (k === "disallow" && v) cur.dis.push(v);
      if (k === "allow" && v) cur.allow.push(v);
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && "vendscout".includes(a.replace(/\/.*/, "")) ));
  const g = mine ?? groups.find((g) => g.agents.includes("*"));
  return { disallow: g?.dis ?? [], allow: g?.allow ?? [] };
}
const toRe = (p: string) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
export function robotsAllows(rules: Rules, pathname: string): boolean {
  let best = -1, allowed = true;
  for (const p of rules.disallow) if (toRe(p).test(pathname) && p.length > best) { best = p.length; allowed = false; }
  for (const p of rules.allow) if (toRe(p).test(pathname) && p.length >= best) { best = p.length; allowed = true; }
  return allowed;
}

async function get(url: string): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,text/plain" }, signal: AbortSignal.timeout(PAGE_MS), redirect: "follow" });
  const buf = (await r.text()).slice(0, MAX_BYTES);
  return { ok: r.ok, status: r.status, text: buf, finalUrl: r.url };
}

// ---- extraction ----
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b|\+\d{1,3}[ .-]?\(?\d{1,4}\)?(?:[ .-]?\d{2,4}){2,4}/g;
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#43;/g, "+").replace(/&#64;/g, "@").replace(/&nbsp;/g, " ");

export function extract(html: string, pageUrl: string): Contact[] {
  const out: Contact[] = [];
  const seen = new Set<string>();
  const add = (kind: Contact["kind"], value: string) => {
    const key = kind + ":" + value.toLowerCase().replace(/[^a-z0-9@.]/g, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value: value.trim(), source: pageUrl });
  };
  const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "));
  for (const m of text.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)) add("email", decodeURIComponent(m[1]));
  for (const m of text.matchAll(/href\s*=\s*["']tel:([^"']+)/gi)) add("phone", decodeURIComponent(m[1]));
  const plain = text.replace(/<[^>]+>/g, " ");
  for (const m of plain.matchAll(EMAIL)) if (!/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(m[0]) && !/^(example|your|name|email)@/i.test(m[0])) add("email", m[0]);
  for (const m of plain.matchAll(PHONE)) add("phone", m[0]);
  for (const m of text.matchAll(/href\s*=\s*["'](https?:\/\/(?:www\.)?(facebook|instagram)\.com\/[^"'\s]+)/gi)) {
    if (/sharer|share\.php|plugins|dialog|tr\?|\/p\/|\/reel\/|login/i.test(m[1])) continue;
    add(m[2].toLowerCase() as "facebook" | "instagram", m[1].replace(/[)"'.,;]+$/, ""));
  }
  return out;
}

export function contactLink(html: string, base: string): string | null {
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = m[2].replace(/<[^>]+>/g, " ");
    if (/contact/i.test(m[1]) || /contact/i.test(label)) {
      try {
        const u = new URL(decode(m[1]), base);
        if (u.hostname.replace(/^www\./, "") === new URL(base).hostname.replace(/^www\./, "") && /^https?:$/.test(u.protocol)) return u.toString();
      } catch { /* skip */ }
    }
  }
  return null;
}

const keyOf = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 20);
export async function readCached(url: string): Promise<SiteResult | null> {
  try {
    return JSON.parse((await readText(`cache/contacts/${keyOf(url)}.json`)) ?? "") as SiteResult;
  } catch {
    return null;
  }
}

// One site at a time, across the whole process.
let chain: Promise<unknown> = Promise.resolve();
export function findContacts(url: string, force = false): Promise<SiteResult> {
  const run = chain.then(() => crawl(url, force), () => crawl(url, force));
  chain = run.catch(() => undefined);
  return run;
}

async function crawl(url: string, force: boolean): Promise<SiteResult> {
  const cached = await readCached(url);
  if (cached && !force && Date.now() - cached.fetchedAt < WEEK) return cached;
  const result: SiteResult = { url, fetchedAt: Date.now(), pages: [], contacts: [] };
  const finish = async (note?: string) => {
    result.note = note;
    await writeText(`cache/contacts/${keyOf(url)}.json`, JSON.stringify(result)).catch(() => undefined);
    return result;
  };
  const origin = new URL(url);
  let rules: Rules = { disallow: [], allow: [] };
  try {
    const rb = await get(origin.origin + "/robots.txt");
    if (rb.ok && !/<html/i.test(rb.text.slice(0, 300))) rules = parseRobots(rb.text);
  } catch { /* no robots.txt reachable: nothing forbids us */ }
  if (!robotsAllows(rules, origin.pathname || "/")) return finish("The site's robots.txt asks robots not to read this page, so we did not.");
  const queue = [url];
  let tried = 0;
  let contactTried = false;
  while (queue.length && tried < MAX_PAGES) {
    const u = queue.shift()!;
    if (result.pages.includes(u)) continue;
    const p = new URL(u);
    if (!robotsAllows(rules, p.pathname + p.search)) continue;
    tried++;
    try {
      const page = await get(u);
      if (!page.ok) { if (tried === 1) return finish(`The site answered with status ${page.status}.`); continue; }
      result.pages.push(u);
      result.contacts.push(...extract(page.text, u));
      if (!contactTried) {
        contactTried = true;
        const link = contactLink(page.text, page.finalUrl);
        if (link) queue.push(link);
        else for (const guess of ["/contact", "/contact-us"]) queue.push(new URL(guess, origin).toString());
      }
    } catch {
      if (tried === 1) return finish("The site did not answer within 10 seconds.");
    }
  }
  const dedup = new Map<string, Contact>();
  for (const c of result.contacts) { const k = c.kind + c.value.toLowerCase().replace(/[^a-z0-9@.]/g, ""); if (!dedup.has(k)) dedup.set(k, c); }
  result.contacts = [...dedup.values()];
  return finish(result.contacts.length ? undefined : "The pages we read list no email or phone.");
}
