// The 53 regions in the USA place data (49 states plus DC, Puerto Rico and the US Virgin Islands, with Illinois also bundled), by Geofabrik slug.
export const STATE_SLUGS = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "district-of-columbia", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana",
  "nebraska", "nevada", "new-hampshire", "new-jersey", "new-mexico", "new-york", "north-carolina", "north-dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
  "puerto-rico", "rhode-island", "south-carolina", "south-dakota", "tennessee", "texas", "us-virgin-islands", "utah", "vermont", "virginia", "washington",
  "west-virginia", "wisconsin", "wyoming",
] as const;
export type StateSlug = (typeof STATE_SLUGS)[number];

export function stateName(slug: string): string {
  if (slug === "us-virgin-islands") return "U.S. Virgin Islands";
  if (slug === "district-of-columbia") return "District of Columbia";
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
export const STATES = STATE_SLUGS.map((slug) => ({ slug, name: stateName(slug) }));

/** A name from Nominatim ("Texas", "United States Virgin Islands", "Washington, D.C.") to a slug, or null. */
export function stateFromName(name: string | undefined | null): StateSlug | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[.,]/g, "").replace(/^united states virgin islands$/, "us virgin islands").replace(/^washington dc$/, "district of columbia").replace(/\s+/g, "-");
  if (n === "us-virgin-islands" || n === "virgin-islands") return "us-virgin-islands";
  if (n === "estado-libre-asociado-de-puerto-rico") return "puerto-rico";
  return (STATE_SLUGS as readonly string[]).includes(n) ? (n as StateSlug) : null;
}
