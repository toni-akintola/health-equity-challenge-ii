import path from "path";
import fs from "fs/promises";

const GEJSON_DIR = path.join(process.cwd(), "public", "geojson");
const TRACT_DATA_DIR = path.join(GEJSON_DIR, "tract-data");

let stateFipsMap: Record<string, string> | null = null;

function geoid11(id: string): string {
  const num = id.replace(/\D/g, "");
  return num.padStart(11, "0");
}

async function getStateFipsMap(): Promise<Record<string, string>> {
  if (stateFipsMap) return stateFipsMap;
  const raw = await fs.readFile(
    path.join(GEJSON_DIR, "state-fips.json"),
    "utf-8"
  );
  stateFipsMap = JSON.parse(raw) as Record<string, string>;
  return stateFipsMap;
}

export type TractRecord = Record<string, unknown>;

export async function getTractById(id: string): Promise<TractRecord | null> {
  const geoid = geoid11(id);
  const stateFips = geoid.slice(0, 2);
  const stateFipsMap = await getStateFipsMap();
  const stateAbbrev = stateFipsMap[stateFips];
  if (!stateAbbrev) return null;

  let tractData: Record<string, TractRecord>;
  try {
    const raw = await fs.readFile(
      path.join(TRACT_DATA_DIR, `${stateAbbrev}.json`),
      "utf-8"
    );
    tractData = JSON.parse(raw);
  } catch {
    return null;
  }

  const tract = tractData[geoid] ?? null;
  return tract;
}
