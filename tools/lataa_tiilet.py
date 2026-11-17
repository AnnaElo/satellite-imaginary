#!/usr/bin/env python3
"""Lataa satelliittikuvatiilet offline-käyttöön kansioon tiles/.

Aja koneella, jossa on verkkoyhteys, mieluiten päivää ennen tapahtumaa:
    python tools/lataa_tiilet.py            (pohjakuva + Suomi + Oulu)
    python tools/lataa_tiilet.py --daily    (lisäksi kahden viime päivän VIIRS-kuvat)

Kirjoittaa tiles/manifest.js, jonka avulla esitys löytää tiilet ilman verkkoa.
"""
import argparse, datetime, json, math, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, "tiles")

GIBS = os.environ.get("MAAPALLO_GIBS", "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best")
EOX = os.environ.get("MAAPALLO_EOX", "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g")

FINLAND = (19.0, 59.5, 32.0, 70.2)   # länsi, etelä, itä, pohjoinen
OULU = (24.7, 64.75, 26.2, 65.25)


DAILY_SATS = ["VIIRS_SNPP_CorrectedReflectance_TrueColor",
              "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
              "VIIRS_NOAA21_CorrectedReflectance_TrueColor"]


def layers(daily_dates):
    out = [
        dict(name="base", url=GIBS + "/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
             levels=range(0, 6), bounds=None),
    ]
    # Tuoreet kuvat: vanhin päivä ensin, jotta uusin jää päällimmäiseksi
    for date in daily_dates:
        for sat in DAILY_SATS:
            short = sat.split("_")[1].lower()
            out.append(dict(name=f"daily-{date}-{short}", group="daily", date=date,
                            url=GIBS + f"/{sat}/default/{date}/GoogleMapsCompatible_Level9/{{z}}/{{y}}/{{x}}.png",
                            levels=range(0, 5), bounds=None, ext="png"))
    out += [
        dict(name="finland", url=EOX + "/{z}/{y}/{x}.jpg", levels=range(5, 11), bounds=FINLAND),
        dict(name="oulu", url=EOX + "/{z}/{y}/{x}.jpg", levels=range(11, 14), bounds=OULU),
    ]
    return out


def tile_range(z, bounds):
    n = 2 ** z
    if bounds is None:
        return range(n), range(n)
    w, s, e, nn = bounds
    def x(lon): return min(n - 1, max(0, int((lon + 180) / 360 * n)))
    def y(lat):
        r = math.radians(lat)
        return min(n - 1, max(0, int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)))
    return range(x(w), x(e) + 1), range(y(nn), y(s) + 1)


def fetch(job):
    url, path = job
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return "skip"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "maapallo-offline/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path + ".part", "wb") as f:
                f.write(data)
            os.replace(path + ".part", path)
            return "ok"
        except Exception as ex:  # noqa: BLE001
            err = ex
            time.sleep(1.5 * (attempt + 1))
    return f"fail {url}: {err}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--daily", action="store_true", help="lataa myös kahden viime päivän VIIRS-kuvat")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--dry-run", action="store_true", help="näytä vain tiilten määrä")
    a = ap.parse_args()

    now = datetime.datetime.now(datetime.timezone.utc)
    daily_dates = [(now - datetime.timedelta(days=d)).strftime("%Y-%m-%d") for d in (2, 1)] if a.daily else []
    manifest = []
    jobs = []
    for L in layers(daily_dates):
        count = 0
        for z in L["levels"]:
            xs, ys = tile_range(z, L["bounds"])
            for x in xs:
                for y in ys:
                    url = L["url"].format(z=z, x=x, y=y)
                    jobs.append((url, os.path.join(TILES, L["name"], str(z), str(x), f"{y}.{L.get('ext', 'jpg')}")))
                    count += 1
        print(f"{L['name']:8s} tasot {L['levels'].start}-{L['levels'].stop - 1}: {count} tiiltä")
        entry = dict(name=L["name"], minLevel=L["levels"].start, maxLevel=L["levels"].stop - 1)
        if L["bounds"]:
            entry["bounds"] = list(L["bounds"])
        if L.get("date"):
            entry["date"] = L["date"]
        if L.get("group"):
            entry["group"] = L["group"]
        if L.get("ext"):
            entry["ext"] = L["ext"]
        manifest.append(entry)
    print(f"Yhteensä {len(jobs)} tiiltä")
    if a.dry_run:
        return

    done = fails = 0
    with ThreadPoolExecutor(a.workers) as ex:
        for res in ex.map(fetch, jobs):
            done += 1
            if res.startswith("fail"):
                fails += 1
                print(res, file=sys.stderr)
            if done % 200 == 0 or done == len(jobs):
                print(f"  {done}/{len(jobs)} valmiina")

    with open(os.path.join(TILES, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("// Luotu " + datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + " tools/lataa_tiilet.py\n")
        f.write("window.LOCAL_TILES = " + json.dumps({"layers": manifest}, indent=2) + ";\n")
    print("Valmis." if not fails else f"Valmis, {fails} tiiltä epäonnistui (aja uudelleen, jo ladatut ohitetaan).")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
