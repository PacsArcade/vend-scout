# Vend Scout

Scouting vending-machine spots, running machines and a crew, for frens.earth (a Pac's Arcade project). Next.js, runs on Vercel.

- Setup, env names and what is public: see `DEPLOY.md`.
- Working from a laptop (clone, run, test, rebuild the place data): see `docs/LAPTOP.md`.
- Place data: our own copy of OpenStreetMap for Illinois, built on a home box by `scripts/osm-build` (`npm run osm:refresh`) and kept in `data-osm/`. Other places are asked of Overpass.

## Attribution

Place data © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0): https://www.openstreetmap.org/copyright. The files in `data-osm/` are derived from Geofabrik's Illinois extract (https://download.geofabrik.de) and stay under the ODbL. The map tiles are also from OpenStreetMap.

## Rebuilding the Illinois copy

```
python3 -m venv scripts/osm-build/.venv
scripts/osm-build/.venv/bin/pip install osmium
npm run osm:refresh
```
It downloads the extract only if Geofabrik has a newer one, checks the md5, moves the old file aside (nothing is deleted), rebuilds `data-osm/`, and prints the counts and what changed. No timer: refresh when you decide to.

## The whole USA, later (design, nothing run yet)

The build takes the region as a parameter: `python scripts/osm-build/build.py --pbf <file> --state <name>` writes `data-osm/<state>/<kind>.json` (and `npm run osm:refresh -- --state indiana` downloads that state's Geofabrik file first). The whole country is the same loop over Geofabrik's per-state files, so the app only ever loads the state or states a place touches.

Size estimate from Illinois: the Illinois files hold 15,507 places in 2.7 MB. Scaling by the extract size (12.2 GB for the USA against 363 MB) gives about 90 MB of JSON, and by population about 70 MB. Gzipped, roughly 20 to 25 MB. That is too big to commit. Proposed home: the Vercel Blob store, uploaded from the house box by a script that reads a token from a git-ignored local env file by name only; the app reads a state's files from Blob and caches them. Illinois stays in the repo.
