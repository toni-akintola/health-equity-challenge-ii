"""
Export EJSCREEN + Census tract geometries to per-state GeoJSON for the Next.js app.
Also exports full tract data (by state) and state FIPS mapping for the tract detail page.
Run from project root: uv run python scripts/export_geojson.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pygris

# Project root (parent of scripts/)
ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "EJSCREEN_2023_Tracts_StatePct_with_AS_CNMI_GU_VI.csv"
OUT_DIR = ROOT / "public" / "geojson"
TRACT_DATA_DIR = OUT_DIR / "tract-data"

# Columns to keep in map GeoJSON (keeps file size down)
PROP_COLUMNS = [
    "ID",
    "ST_ABBREV",
    "CNTY_NAME",
    "P_PM25",
    "P_OZONE",
    "P_DSLPM",
    "P_CANCER",
    "P_RESP",
    "P_RSEI_AIR",
    "P_PTRAF",
    "P_LDPNT",
    "P_PNPL",
    "P_PRMP",
    "P_PTSDF",
    "P_UST",
    "P_PWDIS",
    "P_LOWINCPCT",
    "P_PEOPCOLORPCT",
]


def load_data():
    df = pd.read_csv(CSV_PATH)
    tracts = pygris.tracts(year=2020, cb=True)
    tracts["GEOID"] = pd.to_numeric(tracts["GEOID"], errors="coerce")
    gdf = tracts.merge(df, left_on="GEOID", right_on="ID", how="inner")
    return gdf


def to_geoid_11(val) -> str:
    """Return 11-digit zero-padded GEOID string."""
    return str(int(val)).zfill(11)


def row_to_json_serializable(row: pd.Series) -> dict:
    """Convert a pandas Series to a dict with JSON-serializable values."""
    out = {}
    for k, v in row.items():
        if pd.isna(v):
            out[k] = None
        elif isinstance(v, (np.integer, np.int64)):
            out[k] = int(v)
        elif isinstance(v, (np.floating, np.float64)):
            out[k] = float(v)
        elif isinstance(v, (np.bool_, bool)):
            out[k] = bool(v)
        else:
            out[k] = v
    return out


def main():
    print("Loading EJSCREEN CSV and Census tracts...")
    gdf = load_data()

    # WGS84 for GeoJSON
    gdf = gdf.to_crs("EPSG:4326")

    # State FIPS (first 2 digits of GEOID) -> ST_ABBREV for API lookups
    gdf["_geoid11"] = gdf["ID"].apply(to_geoid_11)
    gdf["_state_fips"] = gdf["_geoid11"].str[:2]
    state_fips = (
        gdf[["_state_fips", "ST_ABBREV"]]
        .drop_duplicates()
        .set_index("_state_fips")["ST_ABBREV"]
        .to_dict()
    )

    # Map GeoJSON: minimal columns + geometry
    cols = [c for c in PROP_COLUMNS if c in gdf.columns]
    gdf_map = gdf[cols + ["geometry"]]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TRACT_DATA_DIR.mkdir(parents=True, exist_ok=True)

    states = sorted(gdf["ST_ABBREV"].dropna().unique().tolist())
    print(f"Exporting GeoJSON for {len(states)} states...")

    for state in states:
        subset = gdf_map[gdf_map["ST_ABBREV"] == state]
        path = OUT_DIR / f"{state}.geojson"
        subset.to_file(path, driver="GeoJSON")
        print(f"  {state}: {len(subset)} tracts -> {path.name}")

    # Full tract data for detail page: one JSON per state, keyed by 11-char GEOID
    print("Exporting tract data for detail pages...")
    drop_cols = ["geometry", "_geoid11", "_state_fips"]
    for state in states:
        subset = gdf[gdf["ST_ABBREV"] == state]
        tract_data = {}
        for _, row in subset.iterrows():
            geoid = row["_geoid11"]
            rec = row.drop(labels=drop_cols, errors="ignore")
            tract_data[geoid] = row_to_json_serializable(rec)
        path = TRACT_DATA_DIR / f"{state}.json"
        with open(path, "w") as f:
            json.dump(tract_data, f, indent=0)
        print(f"  {state}: {len(tract_data)} tracts -> tract-data/{path.name}")

    (OUT_DIR / "state-fips.json").write_text(json.dumps(state_fips, indent=2))
    print("Wrote public/geojson/state-fips.json")

    # Manifest for the frontend
    manifest = {
        "states": states,
        "indicators": [
            {"value": "P_PM25", "label": "PM 2.5"},
            {"value": "P_OZONE", "label": "Ozone"},
            {"value": "P_DSLPM", "label": "Diesel PM"},
            {"value": "P_CANCER", "label": "Cancer Risk"},
            {"value": "P_RESP", "label": "Respiratory Hazard"},
            {"value": "P_RSEI_AIR", "label": "RSEI Air"},
            {"value": "P_PTRAF", "label": "Traffic Proximity"},
            {"value": "P_LDPNT", "label": "Lead Paint"},
            {"value": "P_PNPL", "label": "NPL Sites"},
            {"value": "P_PRMP", "label": "RMP Facilities"},
            {"value": "P_PTSDF", "label": "TSDF Proximity"},
            {"value": "P_UST", "label": "UST Proximity"},
            {"value": "P_PWDIS", "label": "Wastewater Discharge"},
            {"value": "P_LOWINCPCT", "label": "Low Income %"},
            {"value": "P_PEOPCOLORPCT", "label": "People of Color %"},
        ],
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print("Wrote public/geojson/manifest.json")


if __name__ == "__main__":
    main()
