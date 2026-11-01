#!/usr/bin/env python3
"""Build every state in osm-source/usa/ (plus Illinois) into osm-out/<state>/<kind>.json.gz, one state at a time,
then write osm-out/usa-index.json. Resumable: a state whose meta.json already holds the source md5 is skipped.
Usage: build-all.py [--state x] [--force]"""
import argparse, glob, json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "osm-source")
OUT = os.path.join(ROOT, "osm-out")
PY = os.path.join(HERE, ".venv", "bin", "python")


def sources():
    s = {"illinois": (os.path.join(SRC, "illinois-latest.osm.pbf"), None)}
    for p in sorted(glob.glob(os.path.join(SRC, "usa", "*-latest.osm.pbf"))):
        name = os.path.basename(p)[: -len("-latest.osm.pbf")]
        ok = p[: -len(".osm.pbf")] + ".ok"
        ok2 = p + ".ok"
        f = ok if os.path.exists(ok) else ok2
        md5 = open(f).read().split()[0] if os.path.exists(f) else None
        s[name] = (p, md5)
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state"); ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    os.makedirs(os.path.join(OUT, ".tmp"), exist_ok=True)
    src = sources()
    if a.state: src = {a.state: src[a.state]}
    for name, (pbf, md5) in src.items():
        mp = os.path.join(OUT, name, "meta.json")
        if not a.force and os.path.exists(mp) and md5 and json.load(open(mp)).get("md5") == md5:
            print(f"{name}: up to date"); continue
        t = time.time(); loc = os.path.join(OUT, ".tmp", f"{name}.loc")
        cmd = [PY, os.path.join(HERE, "build.py"), "--pbf", pbf, "--out", OUT, "--state", name, "--gzip", "--no-cities", "--no-areas", "--loc-cache", loc]
        if md5: cmd += ["--md5", md5]
        r = subprocess.run(["nice", "-n", "10"] + cmd, capture_output=True, text=True)
        if r.returncode:
            print(f"{name}: FAILED {r.stderr[-300:]}"); continue
        m = json.load(open(mp)); m["buildSeconds"] = round(time.time() - t, 1); json.dump(m, open(mp, "w"), separators=(",", ":"))
        if os.path.exists(loc): os.replace(loc, loc + ".done")  # keep nothing big: truncate below
        open(loc + ".done", "w").close()
        print(f"{name}: {sum(m['counts']['illinois'].values())} places, {sum(m['bytes'].values())/1e6:.2f} MB gz, {m['buildSeconds']} s", flush=True)
    index = {}
    for mp in sorted(glob.glob(os.path.join(OUT, "*", "meta.json"))):
        m = json.load(open(mp)); n = m["state"]
        index[n] = {"extractedAt": m["extractedAt"], "md5": m.get("md5"), "counts": m["counts"]["illinois"], "total": sum(m["counts"]["illinois"].values()),
                    "bytes": m["bytes"], "bounds": m["bounds"], "buildSeconds": m.get("buildSeconds")}
    json.dump({"v": 1, "license": "ODbL 1.0, (c) OpenStreetMap contributors", "states": index}, open(os.path.join(OUT, "usa-index.json"), "w"), separators=(",", ":"))
    print(f"usa-index.json: {len(index)} states")


if __name__ == "__main__":
    sys.exit(main())
