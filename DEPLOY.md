# Deploying Vend Scout (vend.frens.earth)

Names only. Never put values in this file or in the repo.

## What runs where
- The site runs on Vercel, like frens.earth. Live starts EMPTY: nothing is seeded.
- The AI photo checker runs on the home box only. On Vercel it is skipped and every proof goes to a person.

## Environment names the live site needs
| Name | Needed | What it does |
|---|---|---|
| `BLOB_STORE_ID` or `BLOB_READ_WRITE_TOKEN` | yes (one of them) | Connecting a Blob store to the project provides one of these. Newer stores connect with OIDC: Vercel adds `BLOB_STORE_ID` (and `BLOB_WEBHOOK_PUBLIC_KEY`) and supplies the sign-in token at runtime, with no read-write token. Older stores add `BLOB_READ_WRITE_TOKEN`. Either counts as connected; the app never passes a token itself. All state, scan caches and photos are kept as PRIVATE blobs under `vend/`. On Vercel with neither, the app refuses to scan and shows "Storage is not connected" (it never falls back to files). Create the Blob store as a private store. |
| `OPERATOR_NPUBS` | yes | Comma separated npubs allowed to sign in as operator. Nobody can open admin until at least one is set. |
| `VEND_SESSION_SECRET` | yes | Signs the operator and crew session cookies. A long random string. |
| `CRON_SECRET` | yes | Vercel sends it as `Authorization: Bearer ...` on the daily scan-ahead (`/api/cron/scan`, set in `vercel.json`, once a day on Hobby). With no secret set the route refuses every call. |
| `VERCEL` | automatic | Set by Vercel. It turns the operator gate on. |

## Optional names
| Name | What it does |
|---|---|
| `VEND_DM_SENDER_KEY` | The house key that sends the welcome DM to new crew (NIP-17 private message). An nsec or 64 hex characters, set by the Admiral. The app never generates or prints it. With it unset, the DM is not sent: the text is shown in the app and `dm skipped: no sender key` is logged. Use a dedicated key, not a personal one. |
| `VEND_CONTACT_EMAIL` | A public contact address. Shown as a mailto line in the footer (so also on /crew and /host). Hidden when unset. |
| `OLLAMA_URL` | Address of an Ollama server for the photo checker. Leave it unset on Vercel (the checker is skipped with the reason "AI checker runs on the home box"). Set it only on the home box, for example when running the app there. |
| `VEND_AI_MODEL` | Model name for the checker. Default `gemma3:12b`. |
| `VEND_REQUIRE_OPERATOR` | Set to `1` to turn the operator gate on outside Vercel (for a home-box trial of the live behaviour). |
| `FRENS_SUBNAME_SECRET_VEND` | Shared secret for seating crew names (`<name>.vend@frens`) through frens.earth. Must be the same value on this project and on the frens.earth project. Server only, never shown or logged. Unset means the crew name step shows "Crew names are off". |
| `FRENS_API_BASE` | Override for the frens.earth origin the crew name call goes to. Default `https://frens.earth`. |
| `VEND_PRICE` | Set to `off` (tests and offline dev) to skip the price lookup and use the fixed sats per dollar. |

## Dev and test only (never set on Vercel)
`VEND_STATE_FILE` (use a local JSON file instead of Blob), `VEND_DEMO_CLOCK` (the clock demo switch), `VEND_DEMO_DM` (shows the welcome card for screenshots), `VEND_DEMO_DROP` (replays saved pins dropping in, for screenshots), `VEND_FORCE_NO_STORAGE` (pretends storage is missing, for screenshots), `VEND_AI_CHECK` (set `off` to stop the background checker).

## What is public and what is not
Public with no sign-in: the scout map (read-only, no contacts), `/crew`, `/crew/apply` (rate limited, with a honeypot field), `/host/[prospect]`, `/api/crew/postings`, and the `/vote` and `/pay` preview pages.
Operators only: `/admin` and everything under it, every write action in `/api/do` except applying and the host's machine choice, every page that shows owner contacts, photos, applicants, machines, jobs and routes.
Crew pages (`/work`, `/run`, `/jobs`) need a nostr sign-in (`/crew/signin`) by someone whose npub is linked to an applicant who is On the crew. Operators link an npub on `/crew/applicants` (or the applicant adds it on the apply form). A crew member can only act as themselves. On sign-in the app offers the Lightning address from their nostr profile (kind 0, lud16, read in the browser from a few public relays) and they confirm it. Operators can do everything.

## Known limits
- Storage is last write wins. Fine for one operator and a small crew; not for heavy concurrent use.
- The apply rate limit is per server instance (a speed bump). The honeypot and operator review are the other layers.
- Operator sign-in works with a nostr signer browser extension. Phone signer doors (as on frens.earth) are not ported yet.
- The first scan of each city is done by an operator ("Scan this place"), which fills the Blob cache.

## USA place data (round 14)

Place data for every state except bundled Illinois is built on the house box and kept in the Blob store, one state at a time.

- Source: Geofabrik `<state>-latest.osm.pbf` files in `osm-source/usa/` (git-ignored), md5 checked. `npm run osm:refresh` follows Geofabrik's 307 redirect to the dated file and records the md5.
- Build: `npm run osm:build` runs `scripts/osm-build/build-all.py`, one state at a time, into `osm-out/<state>/<kind>.json.gz` (git-ignored) and writes `osm-out/usa-index.json` (counts, sizes and data bounds per state). `--state texas` builds one, `--force` rebuilds.
- Upload: `npm run osm:upload` (or `-- --state texas`, `-- --force`) sends to the Blob store under `osm/<state>/<kind>.json.gz`, private, overwrite allowed, one week of edge cache, and `osm/usa-index.json` last. Resumable: `osm-out/.uploaded.json` remembers what was sent. The token is read by name from `.env.upload` (git-ignored) and never printed.
- App: a place outside the bundled Illinois copy is cut from the state file(s) its box touches (Blob with the project's own store connection on Vercel, `osm-out/` locally), cached in memory per instance, and saved as the place's scan cache. Overpass is only the fallback when a state file is missing. `VEND_OSM_SOURCE=blob|file` forces the source (a laptop proof of the Blob copy needs the read-write token in the environment and no `BLOB_STORE_ID`).
- ODbL: "Place data (c) OpenStreetMap contributors, ODbL." stays on every page that shows the data.
