import path from "path";
import fs from "fs/promises";
import {
  getStaticAssetBaseUrl,
  loadJsonFromStaticAsset,
} from "./static-asset-url";

const SHAP_DIR = path.join(process.cwd(), "public", "data", "shap");

export type TractShapEntry = { feature: string; shap: number };
export type TractShapData = {
  cancer: TractShapEntry[];
  resp: TractShapEntry[];
};

function geoid11(id: string): string {
  const num = String(id).replace(/\D/g, "");
  return num.padStart(11, "0");
}

/**
 * Load SHAP data for a tract. Returns null if state file or tract not found.
 */
export async function getShapForTract(
  tractId: string,
  stateAbbrev: string,
): Promise<TractShapData | null> {
  const geoid = geoid11(tractId);
  const baseUrl = getStaticAssetBaseUrl();
  try {
    const raw = await loadJsonFromStaticAsset(
      baseUrl,
      `/data/shap/${stateAbbrev}.json`,
      () => fs.readFile(path.join(SHAP_DIR, `${stateAbbrev}.json`), "utf-8"),
    );
    const data = JSON.parse(raw) as Record<string, TractShapData>;
    return data[geoid] ?? null;
  } catch {
    return null;
  }
}
