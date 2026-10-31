import { describe, expect, it } from "vitest";
import { contactLink, extract, isSocialHost, normalizeUrl, osmContacts, parseRobots, robotsAllows } from "./contacts";

describe("robots", () => {
  const r = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/ok\n");
  it("blocks disallowed, allows the rest", () => {
    expect(robotsAllows(r, "/")).toBe(true);
    expect(robotsAllows(r, "/private/x")).toBe(false);
    expect(robotsAllows(r, "/private/ok")).toBe(true);
  });
  it("a full block", () => expect(robotsAllows(parseRobots("User-agent: *\nDisallow: /"), "/contact")).toBe(false));
  it("empty disallow allows all", () => expect(robotsAllows(parseRobots("User-agent: *\nDisallow:"), "/x")).toBe(true));
});
describe("extract", () => {
  const html = `<a href="mailto:hello@example-shop.com?subject=x">Mail</a><a href="tel:+1-312-555-0142">Call</a>
    <p>Phone (312) 555-0199 or sales@example-shop.com</p><img src="logo@2x.png">
    <a href="https://www.facebook.com/exampleshop">fb</a><a href="https://www.facebook.com/sharer/sharer.php?u=1">share</a>`;
  const c = extract(html, "https://example-shop.com/");
  it("finds mailto, tel, plain patterns and a social page", () => {
    expect(c.filter((x) => x.kind === "email").map((x) => x.value).sort()).toEqual(["hello@example-shop.com", "sales@example-shop.com"]);
    expect(c.filter((x) => x.kind === "phone").length).toBe(2);
    expect(c.filter((x) => x.kind === "facebook").length).toBe(1);
  });
  it("records where each came from", () => expect(c.every((x) => x.source === "https://example-shop.com/")).toBe(true));
});
describe("helpers", () => {
  it("finds a contact link on the same site only", () => {
    expect(contactLink('<a href="/contact-us">Contact</a>', "https://a.com/")).toBe("https://a.com/contact-us");
    expect(contactLink('<a href="https://other.com/contact">Contact</a>', "https://a.com/")).toBeNull();
  });
  it("normalizes and spots social hosts", () => {
    expect(normalizeUrl("shop.com")).toBe("https://shop.com/");
    expect(normalizeUrl("nonsense")).toBeNull();
    expect(isSocialHost("https://www.facebook.com/x")).toBe(true);
  });
  it("reads OSM tags with their source", () => {
    const c = osmContacts({ phone: "+1 312 555 0100;+1 312 555 0101", email: "a@b.co" });
    expect(c.length).toBe(3);
    expect(c.every((x) => x.source === "OpenStreetMap")).toBe(true);
  });
});
