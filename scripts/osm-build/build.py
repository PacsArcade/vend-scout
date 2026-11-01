#!/usr/bin/env python3
"""Extract our seven kinds of places from an OpenStreetMap .pbf into the app's cache shape.

Same tag filters as src/lib/overpass.ts FILTER. Nodes as they are; ways and closed-area relations get a centre point
(the middle of their bounding box, like Overpass "out center"). Output goes in data-osm/ (ODbL data, tracked in git):
  data-osm/meta.json
  data-osm/cities/<slug>/<kind>.json     the CacheFile shape the app reads (v, fetchedAt, items), cut to the city box
  data-osm/<state>/<kind>.json           every item in the file, sorted, compact, for cutting any other place by box
  data-osm/<state>/meta.json
The region is a parameter (--state): Illinois today; the other states are built the same way from Geofabrik's per-state files.
"""
import argparse, calendar, json, os, sys, time

import osmium

SCHEMA = 2  # keep equal to SCHEMA in src/lib/overpass.ts (a test checks it)
FILTER = {
    "laundry": ("shop", "laundry"),
    "gym": ("leisure", "fitness_centre"),
    "car_wash": ("amenity", "car_wash"),
    "car_repair": ("shop", "car_repair"),
    "vending": ("amenity", "vending_machine"),
    "convenience": ("shop", "convenience"),
    "fast_food": ("amenity", "fast_food"),
}
ORDER = ["laundry", "gym", "car_wash", "car_repair", "vending", "convenience", "fast_food"]


def kinds_of(tags):
    return [c for c in ORDER if tags.get(FILTER[c][0]) == FILTER[c][1]]


def element(oid, typ, lat, lon, tags):
    """The same fields src/lib/overpass.ts toElement() keeps, with the same fallbacks, and no empty values."""
    street = " ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x)
    contact = {
        "phone": tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile"),
        "email": tags.get("email") or tags.get("contact:email"),
        "website": tags.get("website") or tags.get("contact:website") or tags.get("url"),
        "facebook": tags.get("contact:facebook") or tags.get("facebook"),
        "instagram": tags.get("contact:instagram") or tags.get("instagram"),
    }
    el = {"id": oid, "type": typ, "lat": round(lat, 7), "lon": round(lon, 7)}
    if tags.get("name"): el["name"] = tags["name"]
    if tags.get("opening_hours"): el["opening_hours"] = tags["opening_hours"]
    if street: el["street"] = street
    el["tags"] = {k: v for k, v in contact.items() if v}
    return el


def centre(points):
    return (min(p[0] for p in points) + max(p[0] for p in points)) / 2, (min(p[1] for p in points) + max(p[1] for p in points)) / 2


def extract(path, areas=True, locations="flex_mem"):
    """Returns ({kind: [items]}, extract timestamp in ms or None). areas=False skips multipolygon relations (about 0.1 percent of places, and a lot less memory on big states)."""
    fp = osmium.FileProcessor(path).with_locations(locations)
    if areas:
        fp = fp.with_areas()
    fp = fp.with_filter(osmium.filter.TagFilter(*[FILTER[c] for c in ORDER]))
    out = {c: [] for c in ORDER}
    for o in fp:
        tags = {t.k: t.v for t in o.tags}
        ks = kinds_of(tags)
        if not ks:
            continue
        if o.is_node():
            if not o.location.valid():
                continue
            lat, lon, typ, oid = o.location.lat, o.location.lon, "node", o.id
        elif o.is_way():
            pts = [(n.lat, n.lon) for n in o.nodes if n.location.valid()]
            if not pts:
                continue
            (lat, lon), typ, oid = centre(pts), "way", o.id
        elif areas and o.is_area():
            if o.from_way():  # a closed way: already seen as a way above
                continue
            pts = [(n.lat, n.lon) for ring in o.outer_rings() for n in ring if n.location.valid()]
            if not pts:
                continue
            (lat, lon), typ, oid = centre(pts), "relation", o.orig_id()
        else:
            continue
        el = element(oid, typ, lat, lon, tags)
        for c in ks:
            out[c].append(el)
    ts_ms = None
    try:
        ts = osmium.io.Reader(path).header().get("osmosis_replication_timestamp")
        if ts:
            ts_ms = calendar.timegm(time.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")) * 1000
    except Exception:
        ts_ms = None
    return out, ts_ms


def inside(el, b):
    return b["south"] <= el["lat"] <= b["north"] and b["west"] <= el["lon"] <= b["east"]


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if path.endswith(".gz"):
        import gzip
        data = gzip.compress(data, 9, mtime=0)
    with open(path, "wb") as f:
        f.write(data)
    return len(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbf", required=True)
    ap.add_argument("--out", default="data-osm")
    ap.add_argument("--cities", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "cities.json"))
    ap.add_argument("--timestamp-ms", type=int, help="override the extract time (tests)")
    ap.add_argument("--state", default="illinois", help="the region this file covers; its output goes to <out>/<state>/. Only illinois also gets the built-in city files")
    ap.add_argument("--gzip", action="store_true", help="write <kind>.json.gz (for the Blob copy) instead of <kind>.json")
    ap.add_argument("--no-cities", action="store_true", help="do not write the built-in city files")
    ap.add_argument("--no-areas", action="store_true", help="skip multipolygon relations (big states)")
    ap.add_argument("--loc-cache", help="a file to hold node locations on disk instead of in memory (big states)")
    ap.add_argument("--md5", help="the md5 the source file was checked against (recorded in meta.json)")
    a = ap.parse_args()
    cities = json.load(open(a.cities)) if a.state == "illinois" and not a.no_cities else {}
    items, ts = extract(a.pbf, areas=not a.no_areas, locations=f"sparse_file_array,{a.loc_cache}" if a.loc_cache else "flex_mem")
    ts = a.timestamp_ms or ts or int(os.path.getmtime(a.pbf) * 1000)
    sizes = {}
    lats = [e["lat"] for c in ORDER for e in items[c]]; lons = [e["lon"] for c in ORDER for e in items[c]]
    bounds = {"south": min(lats), "north": max(lats), "west": min(lons), "east": max(lons)} if lats else None
    counts = {"illinois": {}, "cities": {}}  # "illinois" holds the totals for whichever state this file is (name kept so the app need not change)
    for c in ORDER:
        state = sorted(items[c], key=lambda e: (e["lat"], e["lon"], e["id"]))
        sizes[c] = dump(os.path.join(a.out, a.state, f"{c}.json" + (".gz" if a.gzip else "")), {"v": SCHEMA, "fetchedAt": ts, "items": state})
        counts["illinois"][c] = len(state)
        for slug, box in cities.items():
            part = [e for e in state if inside(e, box)]
            dump(os.path.join(a.out, "cities", slug, f"{c}.json"), {"v": SCHEMA, "fetchedAt": ts, "items": part})
            counts["cities"].setdefault(slug, {})[c] = len(part)
    meta = {"source": f"Geofabrik {a.state}-latest.osm.pbf", "state": a.state, "license": "ODbL 1.0, (c) OpenStreetMap contributors", "extractedAt": ts,
            "extractedAtISO": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts / 1000)), "md5": a.md5, "counts": counts, "bytes": sizes, "bounds": bounds}
    dump(os.path.join(a.out, a.state, "meta.json"), meta)
    if a.state == "illinois" and not a.no_cities:
        dump(os.path.join(a.out, "meta.json"), meta)  # the app reads this one today
    print(json.dumps(counts))


if __name__ == "__main__":
    sys.exit(main())
