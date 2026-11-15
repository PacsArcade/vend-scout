// r26 (card 06, his pick A): the map credit without the flag Leaflet adds beside its own name.
// The Leaflet link stays, and the OpenStreetMap credit stays (the tile licence asks for it).

/** The credit's first part: a plain link to Leaflet, no flag. Replaces Leaflet's default prefix. */
export const LEAFLET_CREDIT = '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>';
/** The tile credit, on every OpenStreetMap tile layer. */
export const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/** The OpenStreetMap tile address. */
export const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
