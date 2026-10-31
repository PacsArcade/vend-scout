# Deploying Vend Scout (vend.frens.earth)

Names only. Never put values in this file or in the repo.

## What runs where
- The site runs on Vercel, like frens.earth. Live starts EMPTY: nothing is seeded.
- The AI photo checker runs on the home box only. On Vercel it is skipped and every proof goes to a person.

## Environment names the live site needs
| Name | Needed | What it does |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | yes | Gives the app a Vercel Blob store. All state, scan caches and photos are kept there as PRIVATE blobs under `vend/`. Without it the app falls back to local files, which Vercel does not allow. Create the Blob store as a private store. |
| `OPERATOR_NPUBS` | yes | Comma separated npubs allowed to sign in as operator. Nobody can open admin until at least one is set. |
| `VEND_SESSION_SECRET` | yes | Signs the operator session cookie. A long random string. |
| `VERCEL` | automatic | Set by Vercel. It turns the operator gate on. |

## Optional names
| Name | What it does |
|---|---|
| `OLLAMA_URL` | Address of an Ollama server for the photo checker. Leave it unset on Vercel (the checker is skipped with the reason "AI checker runs on the home box"). Set it only on the home box, for example when running the app there. |
| `VEND_AI_MODEL` | Model name for the checker. Default `gemma3:12b`. |
| `VEND_REQUIRE_OPERATOR` | Set to `1` to turn the operator gate on outside Vercel (for a home-box trial of the live behaviour). |

## Dev and test only (never set on Vercel)
`VEND_STATE_FILE` (use a local JSON file instead of Blob), `VEND_DEMO_CLOCK` (the clock demo switch), `VEND_AI_CHECK` (set `off` to stop the background checker).

## What is public and what is not
Public with no sign-in: the scout map (read-only, no contacts), `/crew`, `/crew/apply` (rate limited, with a honeypot field), `/host/[prospect]`, `/api/crew/postings`, and the `/vote` and `/pay` preview pages.
Operators only: `/admin` and everything under it, every write action in `/api/do` except applying and the host's machine choice, every page that shows owner contacts, photos, applicants, machines, jobs and routes.
Crew pages (`/work`, `/run`, `/jobs`) show "Crew sign-in is coming soon" to everyone but operators until crew sign-in exists.

## Known limits
- Storage is last write wins. Fine for one operator and a small crew; not for heavy concurrent use.
- The apply rate limit is per server instance (a speed bump). The honeypot and operator review are the other layers.
- Operator sign-in works with a nostr signer browser extension. Phone signer doors (as on frens.earth) are not ported yet.
- The first scan of each city is done by an operator ("Scan this place"), which fills the Blob cache.
