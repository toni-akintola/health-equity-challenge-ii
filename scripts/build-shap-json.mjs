/**
 * Build per-state SHAP JSON from .data/tract_shap.csv for the Next.js app.
 * Output: public/data/shap/ST.json (keyed by 11-char tract ID, value = { cancer, resp }).
 * Run from project root: node scripts/build-shap-json.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, ".data", "tract_shap.csv");
const OUT_DIR = path.join(ROOT, "public", "data", "shap");

const TOP_KEYS = [
  "top_cancer_1_feature",
  "top_cancer_1_shap",
  "top_cancer_2_feature",
  "top_cancer_2_shap",
  "top_cancer_3_feature",
  "top_cancer_3_shap",
  "top_resp_1_feature",
  "top_resp_1_shap",
  "top_resp_2_feature",
  "top_resp_2_shap",
  "top_resp_3_feature",
  "top_resp_3_shap",
];

function geoid11(id) {
  const num = String(id).replace(/\D/g, "");
  return num.padStart(11, "0");
}

function parseRow(header, line) {
  const parts = line.split(",");
  const row = {};
  header.forEach((h, i) => {
    row[h] = parts[i]?.trim();
  });
  return row;
}

const csv = fs.readFileSync(CSV_PATH, "utf-8");
const lines = csv.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(",").map((h) => h.trim());
const idx = {};
header.forEach((h, i) => {
  idx[h] = i;
});

const hasAll = TOP_KEYS.every((k) => idx[k] !== undefined);
if (!hasAll) {
  console.error(
    "Missing columns in CSV:",
    TOP_KEYS.filter((k) => idx[k] === undefined),
  );
  process.exit(1);
}

const byState = {};

for (let i = 1; i < lines.length; i++) {
  const row = parseRow(header, lines[i]);
  const state = row.ST_ABBREV;
  if (!state) continue;
  const id = geoid11(row.ID);
  const cancer = [
    {
      feature: row.top_cancer_1_feature,
      shap: parseFloat(row.top_cancer_1_shap) || 0,
    },
    {
      feature: row.top_cancer_2_feature,
      shap: parseFloat(row.top_cancer_2_shap) || 0,
    },
    {
      feature: row.top_cancer_3_feature,
      shap: parseFloat(row.top_cancer_3_shap) || 0,
    },
  ];
  const resp = [
    {
      feature: row.top_resp_1_feature,
      shap: parseFloat(row.top_resp_1_shap) || 0,
    },
    {
      feature: row.top_resp_2_feature,
      shap: parseFloat(row.top_resp_2_shap) || 0,
    },
    {
      feature: row.top_resp_3_feature,
      shap: parseFloat(row.top_resp_3_shap) || 0,
    },
  ];
  if (!byState[state]) byState[state] = {};
  byState[state][id] = { cancer, resp };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let total = 0;
for (const [state, tracts] of Object.entries(byState)) {
  const outPath = path.join(OUT_DIR, `${state}.json`);
  fs.writeFileSync(outPath, JSON.stringify(tracts), "utf-8");
  total += Object.keys(tracts).length;
  console.log(`${state}: ${Object.keys(tracts).length} tracts -> ${outPath}`);
}
console.log(
  `Total: ${total} tracts in ${Object.keys(byState).length} state files`,
);
