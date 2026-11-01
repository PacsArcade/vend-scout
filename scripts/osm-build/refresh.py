#!/usr/bin/env python3
"""npm run osm:refresh: download Geofabrik's Illinois extract if it is newer, check its md5, rebuild data-osm/, print the counts and what changed.

Run on the house box, not on Vercel. It needs the venv in scripts/osm-build/.venv (see README). It never deletes anything:
an older source file is moved to osm-source/old/ before the new one takes its place.
Options: --force (download again even if not newer), --rebuild (rebuild from the file we already have, no download).
"""
import argparse, hashlib, json, os, subprocess, sys, time, urllib.request, email.utils

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BASE = "https://download.geofabrik.de/north-america/us"
SRC = os.path.join(ROOT, "osm-source")

OUT = os.path.join(ROOT, "data-osm")
UA = "VendScout/1.0 (Pac's Arcade, pac@pacsarcade.org; daily at most)"


def get(url, method="GET"):
    return urllib.request.urlopen(urllib.request.Request(url, method=method, headers={"User-Agent": UA}), timeout=60)


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--rebuild", action="store_true")
    ap.add_argument("--state", default="illinois", help="a Geofabrik state name, for example illinois or indiana")
    a = ap.parse_args()
    URL = f"{BASE}/{a.state}-latest.osm.pbf"
    PBF = os.path.join(SRC, f"{a.state}-latest.osm.pbf")
    STATE = os.path.join(SRC, f"source-{a.state}.json" if a.state != "illinois" else "source.json")
    os.makedirs(os.path.join(SRC, "old"), exist_ok=True)
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    META = os.path.join(OUT, "meta.json") if a.state == "illinois" else os.path.join(OUT, a.state, "meta.json")
    before = json.load(open(META)) if os.path.exists(META) else None

    md5 = state.get("md5")
    if not a.rebuild:
        head = get(URL, "HEAD")  # Geofabrik answers -latest with a 307 to a dated file; urllib follows it
        if head.geturl() != URL: print(f"  redirected to {head.geturl()}")
        last_mod = head.headers.get("Last-Modified")
        size = int(head.headers.get("Content-Length", "0"))
        if os.path.exists(PBF) and state.get("lastModified") == last_mod and not a.force:
            print(f"Already up to date (Geofabrik file of {last_mod}). Use --force to download again or --rebuild to rebuild.")
            return 0
        print(f"Downloading {URL} ({size / 1e6:.0f} MB, {last_mod})")
        part = PBF + ".part"
        got = 0; t0 = time.time()
        with get(URL) as r, open(part, "wb") as f:
            for chunk in iter(lambda: r.read(1 << 20), b""):
                f.write(chunk); got += len(chunk)
                if int((time.time() - t0)) % 10 == 0:
                    print(f"  {got / 1e6:.0f} MB", end="\r", flush=True)
        print()
        want = get(URL + ".md5").read().decode().split()[0].strip()
        have = md5_of(part)
        if want != have:
            os.rename(part, PBF + f".bad-{int(time.time())}")
            print(f"md5 does not match (wanted {want}, got {have}). The download was set aside, nothing was changed.")
            return 1
        print(f"md5 ok: {have}")
        if os.path.exists(PBF):  # keep one copy: the old one is moved aside, never deleted
            os.rename(PBF, os.path.join(SRC, "old", f"{a.state}-{int(os.path.getmtime(PBF))}.osm.pbf"))
        os.rename(part, PBF)
        md5 = have
        json.dump({"lastModified": last_mod, "md5": md5, "downloadedAt": int(time.time())}, open(STATE, "w"))
    elif not os.path.exists(PBF):
        print("No source file yet. Run without --rebuild first."); return 1

    cmd = [sys.executable, os.path.join(HERE, "build.py"), "--pbf", PBF, "--out", OUT, "--state", a.state] + (["--md5", md5] if md5 else [])
    print("Building", " ".join(os.path.relpath(c, ROOT) if os.path.isabs(c) else c for c in cmd[1:]))
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    after = json.load(open(META))
    print(f"Extract of {after['extractedAtISO']}")
    print("Statewide totals:")
    for k, n in after["counts"]["illinois"].items():
        old = before["counts"]["illinois"].get(k) if before else None
        print(f"  {k:12} {n:7}" + (f"   ({n - old:+d} since {before['extractedAtISO']})" if old is not None else ""))
    print("Cities:")
    for slug, c in after["counts"]["cities"].items():
        print(f"  {slug:15} " + ", ".join(f"{k} {n}" for k, n in c.items()))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f"data-osm total size: {size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
