import path from "path";
import fs from "fs/promises";
import { TractShapData, TractShapEntry } from "./get-shap-for-tract";
import { getShapFeatureLabel } from "./shap-labels";

const GEOJSON_DIR = path.join(process.cwd(), "public", "geojson");
const SHAP_DIR = path.join(process.cwd(), "public", "data", "shap");

type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
type GeoJSONFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

const ENV_PERCENTILE_KEYS = [
  "P_CANCER",
  "P_RESP",
  "P_PM25",
  "P_OZONE",
  "P_DSLPM",
  "P_PTRAF",
  "P_LDPNT",
  "P_PNPL",
  "P_PRMP",
  "P_PTSDF",
  "P_UST",
  "P_PWDIS",
] as const;

const DEMO_PERCENTILE_KEYS = ["P_LOWINCPCT", "P_PEOPCOLORPCT"] as const;

export type CountySummary = {
  name: string;
  tractCount: number;
  avgCancer: number;
  avgResp: number;
  avgEnv: Record<string, number>;
  avgDemo: Record<string, number>;
  topCancerDrivers: { feature: string; count: number }[];
  topRespDrivers: { feature: string; count: number }[];
};

export type StateSummary = {
  stateAbbrev: string;
  tractCount: number;
  countyCount: number;
  avgCancer: number;
  avgResp: number;
  avgEnv: Record<string, number>;
  avgDemo: Record<string, number>;
  topCancerDrivers: { feature: string; count: number }[];
  topRespDrivers: { feature: string; count: number }[];
  counties: CountySummary[];
};

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function countDrivers(
  shapEntries: TractShapEntry[][],
  topN: number = 5
): { feature: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const entries of shapEntries) {
    for (const e of entries) {
      if (e.shap > 0) {
        counts[e.feature] = (counts[e.feature] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export async function getStateSummary(stateAbbrev: string): Promise<StateSummary | null> {
  const upperState = stateAbbrev.toUpperCase();

  let fc: GeoJSONFC;
  try {
    const raw = await fs.readFile(path.join(GEOJSON_DIR, `${upperState}.geojson`), "utf-8");
    fc = JSON.parse(raw) as GeoJSONFC;
  } catch {
    return null;
  }

  let shapData: Record<string, TractShapData> = {};
  try {
    const raw = await fs.readFile(path.join(SHAP_DIR, `${upperState}.json`), "utf-8");
    shapData = JSON.parse(raw) as Record<string, TractShapData>;
  } catch {
    // SHAP data optional
  }

  const countyMap: Map<
    string,
    {
      tracts: GeoJSONFeature[];
      shapCancer: TractShapEntry[][];
      shapResp: TractShapEntry[][];
    }
  > = new Map();

  for (const feature of fc.features) {
    const props = feature.properties ?? {};
    const countyName = String(props.CNTY_NAME ?? "Unknown");
    const geoid = String(props.ID ?? "").padStart(11, "0");

    if (!countyMap.has(countyName)) {
      countyMap.set(countyName, { tracts: [], shapCancer: [], shapResp: [] });
    }
    const entry = countyMap.get(countyName)!;
    entry.tracts.push(feature);

    const tractShap = shapData[geoid];
    if (tractShap) {
      entry.shapCancer.push(tractShap.cancer);
      entry.shapResp.push(tractShap.resp);
    }
  }

  const counties: CountySummary[] = [];
  const allCancerShap: TractShapEntry[][] = [];
  const allRespShap: TractShapEntry[][] = [];

  for (const [name, { tracts, shapCancer, shapResp }] of countyMap) {
    const envValues: Record<string, number[]> = {};
    const demoValues: Record<string, number[]> = {};
    for (const k of ENV_PERCENTILE_KEYS) envValues[k] = [];
    for (const k of DEMO_PERCENTILE_KEYS) demoValues[k] = [];

    for (const f of tracts) {
      const p = f.properties ?? {};
      for (const k of ENV_PERCENTILE_KEYS) {
        const v = p[k];
        if (typeof v === "number" && !isNaN(v)) envValues[k].push(v);
      }
      for (const k of DEMO_PERCENTILE_KEYS) {
        const v = p[k];
        if (typeof v === "number" && !isNaN(v)) demoValues[k].push(v);
      }
    }

    const avgEnv: Record<string, number> = {};
    const avgDemo: Record<string, number> = {};
    for (const k of ENV_PERCENTILE_KEYS) avgEnv[k] = mean(envValues[k]);
    for (const k of DEMO_PERCENTILE_KEYS) avgDemo[k] = mean(demoValues[k]);

    counties.push({
      name,
      tractCount: tracts.length,
      avgCancer: avgEnv["P_CANCER"],
      avgResp: avgEnv["P_RESP"],
      avgEnv,
      avgDemo,
      topCancerDrivers: countDrivers(shapCancer, 3),
      topRespDrivers: countDrivers(shapResp, 3),
    });

    allCancerShap.push(...shapCancer);
    allRespShap.push(...shapResp);
  }

  counties.sort((a, b) => (b.avgCancer + b.avgResp) / 2 - (a.avgCancer + a.avgResp) / 2);

  const totalTracts = counties.reduce((s, c) => s + c.tractCount, 0);
  const stateAvgEnv: Record<string, number> = {};
  const stateAvgDemo: Record<string, number> = {};

  for (const k of ENV_PERCENTILE_KEYS) {
    const weighted = counties.reduce((s, c) => s + c.avgEnv[k] * c.tractCount, 0);
    stateAvgEnv[k] = totalTracts > 0 ? weighted / totalTracts : 0;
  }
  for (const k of DEMO_PERCENTILE_KEYS) {
    const weighted = counties.reduce((s, c) => s + c.avgDemo[k] * c.tractCount, 0);
    stateAvgDemo[k] = totalTracts > 0 ? weighted / totalTracts : 0;
  }

  return {
    stateAbbrev: upperState,
    tractCount: totalTracts,
    countyCount: counties.length,
    avgCancer: stateAvgEnv["P_CANCER"],
    avgResp: stateAvgEnv["P_RESP"],
    avgEnv: stateAvgEnv,
    avgDemo: stateAvgDemo,
    topCancerDrivers: countDrivers(allCancerShap, 5),
    topRespDrivers: countDrivers(allRespShap, 5),
    counties,
  };
}

export function buildStateContext(summary: StateSummary): string {
  const lines: string[] = [];

  lines.push(`# State: ${summary.stateAbbrev}`);
  lines.push(`Total tracts: ${summary.tractCount} | Counties: ${summary.countyCount}`);
  lines.push("");

  lines.push("## Statewide Averages (percentiles)");
  lines.push(`- Cancer risk: ${summary.avgCancer.toFixed(1)}`);
  lines.push(`- Respiratory risk: ${summary.avgResp.toFixed(1)}`);
  lines.push(`- Low-income population: ${summary.avgDemo["P_LOWINCPCT"]?.toFixed(1) ?? "N/A"}`);
  lines.push(`- People of color: ${summary.avgDemo["P_PEOPCOLORPCT"]?.toFixed(1) ?? "N/A"}`);
  lines.push("");

  lines.push("## Statewide Top Risk Drivers (SHAP analysis, by frequency across tracts)");
  if (summary.topCancerDrivers.length) {
    lines.push(
      `- Cancer: ${summary.topCancerDrivers.map((d) => `${getShapFeatureLabel(d.feature)} (${d.count} tracts)`).join(", ")}`
    );
  }
  if (summary.topRespDrivers.length) {
    lines.push(
      `- Respiratory: ${summary.topRespDrivers.map((d) => `${getShapFeatureLabel(d.feature)} (${d.count} tracts)`).join(", ")}`
    );
  }
  lines.push("");

  const TOP_DETAIL = 15;
  const topCounties = summary.counties.slice(0, TOP_DETAIL);

  lines.push(`## Top ${TOP_DETAIL} Highest-Risk Counties (by average cancer + respiratory risk)`);
  lines.push("");

  for (const c of topCounties) {
    lines.push(`### ${c.name} (${c.tractCount} tracts)`);
    lines.push(`- Avg cancer risk: ${c.avgCancer.toFixed(1)} | Avg respiratory risk: ${c.avgResp.toFixed(1)}`);
    lines.push(`- Low-income: ${c.avgDemo["P_LOWINCPCT"]?.toFixed(1) ?? "N/A"} | People of color: ${c.avgDemo["P_PEOPCOLORPCT"]?.toFixed(1) ?? "N/A"}`);
    if (c.topCancerDrivers.length) {
      lines.push(`- Top cancer drivers: ${c.topCancerDrivers.map((d) => getShapFeatureLabel(d.feature)).join(", ")}`);
    }
    if (c.topRespDrivers.length) {
      lines.push(`- Top respiratory drivers: ${c.topRespDrivers.map((d) => getShapFeatureLabel(d.feature)).join(", ")}`);
    }
    lines.push("");
  }

  if (summary.counties.length > TOP_DETAIL) {
    lines.push("## Other Counties (compact summary, sorted by risk)");
    lines.push("");
    const rest = summary.counties.slice(TOP_DETAIL);
    for (const c of rest) {
      const topDriver =
        c.topCancerDrivers[0]?.feature || c.topRespDrivers[0]?.feature || "—";
      lines.push(
        `- ${c.name}: ${c.tractCount} tracts, cancer ${c.avgCancer.toFixed(0)}, resp ${c.avgResp.toFixed(0)}, top driver: ${getShapFeatureLabel(topDriver)}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
