import path from "path";
import fs from "fs/promises";

const GEOJSON_DIR = path.join(process.cwd(), "public", "geojson");

let stateFipsMap: Record<string, string> | null = null;

function geoid11(id: string): string {
  const num = id.replace(/\D/g, "");
  return num.padStart(11, "0");
}

async function getStateFipsMap(): Promise<Record<string, string>> {
  if (stateFipsMap) return stateFipsMap;
  const raw = await fs.readFile(
    path.join(GEOJSON_DIR, "state-fips.json"),
    "utf-8"
  );
  stateFipsMap = JSON.parse(raw) as Record<string, string>;
  return stateFipsMap;
}

type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
type GeoJSONFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

export type TractRecord = Record<string, unknown>;

export async function getTractById(id: string): Promise<TractRecord | null> {
  const geoid = geoid11(id);
  const stateFips = geoid.slice(0, 2);
  const stateFipsMap = await getStateFipsMap();
  const stateAbbrev = stateFipsMap[stateFips];
  if (!stateAbbrev) return null;

  let fc: GeoJSONFC;
  try {
    const raw = await fs.readFile(
      path.join(GEOJSON_DIR, `${stateAbbrev}.geojson`),
      "utf-8"
    );
    fc = JSON.parse(raw) as GeoJSONFC;
  } catch {
    return null;
  }

  const geoidNum = Number(geoid);
  const feature = fc.features?.find(
    (f: GeoJSONFeature) => f.properties?.ID === geoidNum
  );
  return feature?.properties ?? null;
}