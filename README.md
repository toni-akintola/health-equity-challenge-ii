# EJSCREEN Explorer

Environmental justice indicators by census tract (EJSCREEN 2023 + Census 2020 tracts).

## Stack

- **Next.js** (App Router, TypeScript, Tailwind)
- **MapLibre GL** + **react-map-gl** for the choropleth map (no Mapbox token required)
- **Python** script to precompute GeoJSON from EJSCREEN CSV + Census tract geometries

## Setup

### 1. Precompute GeoJSON (one-time or when data changes)

From project root:

```bash
uv run python scripts/export_geojson.py
```

This loads the EJSCREEN CSV and Census tract boundaries (via `pygris`), merges them, and writes per-state GeoJSON to `public/geojson/`, full tract data to `public/geojson/tract-data/`, plus `manifest.json` and `state-fips.json`. Expect a few minutes and network access.

### 2. Install Node dependencies and run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the sidebar to pick states (multi-select) and an indicator (PM 2.5, Ozone, Cancer Risk). The map shows a choropleth; hover tracts for county and values. **Click a tract** to open a popup with a **“View full details”** link to a page that lists all EJSCREEN data for that census tract.

## Scripts

| Command                   | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `npm run dev`             | Start Next.js dev server                              |
| `npm run build`           | Production build                                      |
| `npm run start`           | Run production server                                 |
| `npm run export-geojson`  | Run the Python GeoJSON export script                  |
| `npm run build-shap-json` | Build per-state SHAP JSON from `.data/tract_shap.csv` |

### 3. Policy proposal API (optional)

The app can generate a bespoke policy proposal for a census tract using an LLM with access to tract data (including demographics), SHAP risk drivers, the NCSL legislation database, and optional web search for state/county politics.

1. Add your OpenAI API key to `.env.local` (see `.env.example`).
2. Optionally add `EXA_API_KEY` to enable web search so the model can look up state legislature, governor, and political context to tailor recommendations (see [exa.ai](https://exa.ai)).
3. Run `npm run build-shap-json` if you have `.data/tract_shap.csv` (from the SHAP notebook).
4. Send a `POST` request to `/api/tract/[id]/policy-proposal` with the tract ID (11-digit geoid or numeric). The response includes a `proposal` field with the generated text (Markdown, with citations).

## Legacy Dash app

The original Dash app is in `main.py`. It can still be run with:

```bash
uv run python main.py
```

The Next.js app uses the same data pipeline via `scripts/export_geojson.py` and serves the precomputed GeoJSON from `public/geojson/`.
