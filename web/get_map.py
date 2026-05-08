"""
Génère bassins.geojson — bassins versants du Maroc (HydroSHEDS niveau 4)
Dépendances : pip install geopandas requests shapely
"""
import sys, os, io, zipfile, shutil, json
import requests
from shapely.geometry import box, mapping
import geopandas as gpd

OUT = os.path.join(os.path.dirname(__file__), "bassins.geojson")
TMP = os.path.join(os.path.dirname(__file__), "_hydro_tmp")

# Morocco bounding box (lon_min, lat_min, lon_max, lat_max)
BBOX = box(-17.2, 27.5, -0.9, 36.1)

# ─── Labels officiels des 9 bassins versants du Maroc ───────────────────────
# Mapping HYBAS_ID (niveau 4) → nom officiel, SPI de demo, niveau d'alerte
BASIN_NAMES = {
    # Ces IDs sont approximatifs — le script les ajuste selon l'intersection
    # avec les centres géographiques de chaque bassin.
    # On les enrichit par post-traitement (centroid matching).
}

OFFICIAL_BASINS = [
    {"name": "Loukkos",       "center": (-5.8, 35.1), "spi": 0.2,  "level": "Normal",  "area_km2": 3620},
    {"name": "Tangérois",     "center": (-5.5, 35.6), "spi": -0.4, "level": "Normal",  "area_km2": 1380},
    {"name": "Moulouya",      "center": (-3.5, 33.8), "spi": -1.8, "level": "Sévère",  "area_km2": 51600},
    {"name": "Sebou",         "center": (-5.5, 34.1), "spi": -1.1, "level": "Modéré",  "area_km2": 40000},
    {"name": "Bouregreg",     "center": (-6.6, 33.5), "spi": -1.6, "level": "Sévère",  "area_km2": 9950},
    {"name": "Oum Er-Rbia",   "center": (-7.2, 32.6), "spi": -1.9, "level": "Sévère",  "area_km2": 35000},
    {"name": "Tensift",       "center": (-8.2, 31.3), "spi": -2.2, "level": "Extrême", "area_km2": 19800},
    {"name": "Souss-Massa",   "center": (-9.2, 30.2), "spi": -2.4, "level": "Extrême", "area_km2": 25400},
    {"name": "Drâa-Ziz-Guir", "center": (-5.0, 30.5), "spi": -1.7, "level": "Sévère",  "area_km2": 111000},
]

def assign_name(centroid, basins):
    """Assign the closest official basin name to a HydroSHEDS polygon centroid."""
    from math import hypot
    best, best_d = basins[0], float("inf")
    for b in basins:
        d = hypot(centroid.x - b["center"][0], centroid.y - b["center"][1])
        if d < best_d:
            best_d, best = d, b
    return best

def main():
    print("Téléchargement HydroSHEDS Afrique niveau 4 (~18 MB)...")
    url = "https://data.hydrosheds.org/file/hydrobasins/standard/hybas_af_lev04_v1c.zip"
    try:
        r = requests.get(url, timeout=180, stream=True)
        r.raise_for_status()
    except Exception as e:
        print(f"Erreur téléchargement: {e}")
        print("Vérifiez votre connexion ou téléchargez manuellement depuis hydrosheds.org")
        sys.exit(1)

    total = int(r.headers.get("content-length", 0))
    data = bytearray()
    for chunk in r.iter_content(32768):
        data.extend(chunk)
        if total:
            pct = len(data) / total * 100
            print(f"\r  {pct:.0f}% ({len(data)//1024} KB)", end="", flush=True)
    print()

    print("Extraction...")
    os.makedirs(TMP, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        z.extractall(TMP)

    shp = next(f for f in os.listdir(TMP) if f.endswith(".shp"))
    print(f"Lecture {shp}...")
    gdf = gpd.read_file(os.path.join(TMP, shp))

    print("Filtrage sur le Maroc...")
    gdf = gdf[gdf.geometry.intersects(BBOX)].copy()
    gdf = gdf.to_crs("EPSG:4326")
    # Clip precisely to Morocco bbox
    gdf["geometry"] = gdf.geometry.intersection(BBOX)
    gdf = gdf[~gdf.geometry.is_empty].copy()

    print(f"  {len(gdf)} polygones trouvés")

    # Assign names and SPI from our official list
    gdf["basin_name"]  = gdf.geometry.centroid.apply(lambda c: assign_name(c, OFFICIAL_BASINS)["name"])
    gdf["spi"]         = gdf.geometry.centroid.apply(lambda c: assign_name(c, OFFICIAL_BASINS)["spi"])
    gdf["alert_level"] = gdf.geometry.centroid.apply(lambda c: assign_name(c, OFFICIAL_BASINS)["level"])
    gdf["area_km2"]    = gdf.geometry.centroid.apply(lambda c: assign_name(c, OFFICIAL_BASINS)["area_km2"])

    # Dissolve by basin_name to merge sub-basins into the 9 major ones
    print("Dissolution par bassin officiel...")
    gdf_dissolved = gdf.dissolve(by="basin_name", as_index=False)
    # Re-attach SPI/level (lost after dissolve)
    meta = {b["name"]: b for b in OFFICIAL_BASINS}
    gdf_dissolved["spi"]         = gdf_dissolved["basin_name"].map(lambda n: meta.get(n, {}).get("spi", 0))
    gdf_dissolved["alert_level"] = gdf_dissolved["basin_name"].map(lambda n: meta.get(n, {}).get("level", ""))
    gdf_dissolved["area_km2"]    = gdf_dissolved["basin_name"].map(lambda n: meta.get(n, {}).get("area_km2", 0))

    # Simplify geometry for web (tolerance in degrees ~1km)
    gdf_dissolved["geometry"] = gdf_dissolved.geometry.simplify(0.01, preserve_topology=True)

    print(f"Export -> {OUT}")
    gdf_dissolved[["basin_name","spi","alert_level","area_km2","geometry"]].to_file(OUT, driver="GeoJSON")

    shutil.rmtree(TMP, ignore_errors=True)
    print(f"\nTermine - {len(gdf_dissolved)} bassins versants exportes.")
    print(f"Fichier : {OUT}")

if __name__ == "__main__":
    main()
