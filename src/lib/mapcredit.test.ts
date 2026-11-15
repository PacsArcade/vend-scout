import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { LEAFLET_CREDIT, OSM_CREDIT } from "./mapcredit";

// r26 (card 06): "Leaflet | © OpenStreetMap contributors", no flag. Both links stay.
describe("the map credit", () => {
  it("links Leaflet with no flag", () => {
    expect(LEAFLET_CREDIT).toContain('href="https://leafletjs.com"');
    expect(LEAFLET_CREDIT).toMatch(/>Leaflet<\/a>$/);
    expect(LEAFLET_CREDIT).not.toMatch(/<svg|flag/i);
  });
  it("keeps the OpenStreetMap credit and its copyright link", () => {
    expect(OSM_CREDIT).toBe('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
  });
  it("every Leaflet map sets the plain prefix and the OSM credit", () => {
    for (const f of ["ScoutClient.tsx", "MiniMap.tsx"]) {
      const src = readFileSync(path.join(__dirname, "../components", f), "utf8");
      expect(src, f).toMatch(/attributionControl\.setPrefix\(LEAFLET_CREDIT\)/);
      expect(src, f).toMatch(/attribution: OSM_CREDIT/);
    }
  });
});
