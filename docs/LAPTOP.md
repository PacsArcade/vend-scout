# Working on Vend Scout from a laptop

This is the short path from nothing to a running copy. Everything here is safe to follow in a public repo: it names environment variables but never holds a value.

## 1. Get the code

```
git clone https://github.com/PacsArcade/vend-scout.git
cd vend-scout
```

Pushes to `master` deploy the live site on Vercel (the production site, with real visitors). Work on a branch and open a pull request unless you mean to ship.

## 2. Node

Use a current Node release. Next.js 16 needs Node 20.9 or newer, and the project is developed on a current one, so take the latest LTS or newer. `package.json` has no `engines` field and there is no `.nvmrc`.

```
node --version
npm ci
```

`npm ci` installs exactly what `package-lock.json` says.

## 3. Run it with local file storage (no env needed)

```
npm run dev
```

The app opens on port 4310. With no environment set it stores everything in `data/` on disk (the file driver), the operator gate is off, and nothing talks to Vercel Blob. The local state is git-ignored.

A seeded demo state is available: `node scripts/seed-local-test.mjs data/state.seed.json`, then start with `VEND_STATE_FILE=data/state.seed.json npm run dev`.

## 4. Tests and checks

```
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Tests run offline. They set `VEND_PRICE=off` so no test asks a price service for anything. Before a push, run all four.

## 5. Environment names

Every environment variable the live site uses is listed by name in `DEPLOY.md` (required, optional, and dev only). That file never holds values.

To get the live values onto a laptop you need the project owner's Vercel login:

```
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

Without that login you cannot pull them, and you do not need them for local work. Never commit `.env.local`, never paste a value into an issue or a chat, and never print an env file to look at it.

## 6. The place data is not in git

- `osm-source/` holds the raw OpenStreetMap downloads (about 11 GB for the USA). It is git-ignored.
- `osm-out/` holds the built per-state files. It is git-ignored too.
- `data-osm/` (Illinois, about 4 MB) is the only copy that is committed and ships with the app.

Without `osm-out/`, local scans of a place outside Illinois fall back to asking Overpass (operator only), which is slower. Public visitors on the live site read the same state files from the Vercel Blob store, so a laptop does not need them for most work.

To rebuild:

```
python3 -m venv scripts/osm-build/.venv
scripts/osm-build/.venv/bin/pip install osmium
npm run osm:refresh            # Illinois, downloads only if Geofabrik has a newer file
npm run osm:build              # every state that has a file in osm-source/usa/, one at a time
npm run osm:build -- --state texas
```

The source files come from Geofabrik (`<state>-latest.osm.pbf`) and must sit in `osm-source/usa/` with a matching `.ok` file holding the md5. The build needs Python 3 and the `osmium` package in the `scripts/osm-build/.venv` virtual environment, and a few GB of free memory (it runs one state at a time).

## 7. Uploading to Blob

```
npm run osm:upload
npm run osm:upload -- --state texas
```

This needs a file named `.env.upload` in the project root (git-ignored) with two quoted lines: `BLOB_STORE_ID="..."` and `BLOB_READ_WRITE_TOKEN="..."`. The read-write token is made in the Vercel dashboard (Storage, the Blob store, create a read-write token). The script reads the file by name, never prints a value, resumes where it left off, and sends the index file last.

## 8. Crew names

Crew names (`<name>.vend@frens`) are seated through frens.earth when an operator moves an applicant On the crew. Locally this step shows "Crew names are off" unless `FRENS_SUBNAME_SECRET_VEND` is set, which you do not need for normal work.
