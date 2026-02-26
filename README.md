# EJSCREEN Explorer

Environmental justice indicators by census tract (EJSCREEN 2023 + Census 2020 tracts).

## Repository structure (for reviewers and researchers)

This section explains where everything lives so you can locate the code and data that power each part of the project.

| Folder / area | What it is | What you’ll find there |
|---------------|------------|-------------------------|
| **`src/app/`** | Web app pages and API endpoints | **`page.tsx`** = home page (map + sidebar). **`tract/[id]/page.tsx`** = tract detail page (all EJSCREEN fields + “Generate policy proposal”). **`api/`** = backend endpoints that return JSON or generate proposals. |
| **`src/components/`** | Reusable UI pieces | **`EJScreenMap.tsx`** = the interactive map (state selection, choropleth, tract hover/click). **`PolicyProposalDialog.tsx`** = tract-level proposal modal. **`StateProposalDialog.tsx`** = state-level proposal modal. **`ProposalMarkdown.tsx`** = renders the proposal text. |
| **`src/lib/`** | Data loading and tools used by the API | **`tract-data.ts`** = loads tract GeoJSON and returns EJSCREEN data for a tract. **`get-shap-for-tract.ts`** = loads SHAP “risk driver” data per tract. **`state-summary.ts`** = builds state-level summary (counties, averages, top drivers). **`ncsl-tool.ts`** = fetches NCSL legislation database for the LLM. **`web-search.ts`** = optional web search (e.g. Exa) for political context. **`shap-labels.ts`** = human-readable names for SHAP features. |
| **`public/geojson/`** | Precomputed map and lookup data | One GeoJSON file per state (e.g. `IN.geojson`), **`state-fips.json`** (state FIPS → abbreviation), **`manifest.json`**, and optionally **`tract-data/`** with full tract records. Produced by **`scripts/export_geojson.py`**. |
| **`public/data/shap/`** | SHAP risk-driver data for policy proposals | One JSON file per state (e.g. `IN.json`), keyed by tract ID. Produced by **`scripts/build-shap-json.mjs`** from **`.data/tract_shap.csv`**. |
| **`scripts/`** | One-off data prep (run locally) | **`export_geojson.py`** = reads EJSCREEN CSV + Census tracts, writes **`public/geojson/`**. **`build-shap-json.mjs`** = reads **`.data/tract_shap.csv`**, writes **`public/data/shap/`**. |
| **`notebooks/`** | Analysis and model pipelines | **`run_shap.ipynb`** = SHAP pipeline (models + feature importance) → **`.data/tract_shap.csv`** and **`.data/shap_importance.csv`**. **`build_analysis_minimal.ipynb`** = builds **`.data/analysis_minimal.csv`** (used by the SHAP notebook). **`clean.ipynb`** = data cleaning/exploration. |
| **`main.py`** | Legacy Dash app | Original interactive Dash app; uses the same **`public/geojson/`** data. Optional to run. |

**High-level flow**

1. **Data pipeline:** EJSCREEN CSV + Census geometries → **`scripts/export_geojson.py`** → **`public/geojson/`**. Optional: **notebooks** → **`.data/tract_shap.csv`** → **`scripts/build-shap-json.mjs`** → **`public/data/shap/`**.
2. **Map and tract details:** **`src/app/page.tsx`** and **`EJScreenMap.tsx`** use **`public/geojson/`**. **`src/app/tract/[id]/page.tsx`** and **`src/lib/tract-data.ts`** load tract data from the same source.
3. **Policy proposals:** User clicks “Generate policy proposal” on a tract or state. The app calls **`/api/tract/[id]/policy-proposal`** or **`/api/state/[abbrev]/policy-proposal`**. Those API routes use **`tract-data`**, **`get-shap-for-tract`**, **`state-summary`**, **`ncsl-tool`**, and optionally **`web-search`**, then send context to an LLM to produce the proposal text.

**Quick links for reviewers**

- **Map and tract selection:** `src/components/EJScreenMap.tsx`, `src/app/page.tsx`
- **Tract detail page (all EJSCREEN fields):** `src/app/tract/[id]/page.tsx`
- **Tract-level policy proposal (LLM + SHAP + NCSL):** `src/app/api/tract/[id]/policy-proposal/route.ts`, `src/lib/get-shap-for-tract.ts`, `src/lib/ncsl-tool.ts`
- **State-level policy proposal:** `src/app/api/state/[abbrev]/policy-proposal/route.ts`, `src/lib/state-summary.ts`
- **Where tract/state data is loaded from:** `src/lib/tract-data.ts`, `src/lib/state-summary.ts`
- **How GeoJSON and SHAP data are built:** `scripts/export_geojson.py`, `scripts/build-shap-json.mjs`
- **How SHAP inputs are created:** `notebooks/run_shap.ipynb`, `notebooks/build_analysis_minimal.ipynb`

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
