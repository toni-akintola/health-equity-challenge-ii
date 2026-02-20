"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  MapLayerMouseEvent,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { getShapFeatureLabel } from "@/src/lib/shap-labels";
import { StateProposalDialog } from "@/src/components/StateProposalDialog";

function geoid11(id: number | string): string {
  const num = String(id).replace(/\D/g, "");
  return num.padStart(11, "0");
}

type TractShapEntry = {
  feature: string;
  shap: number;
};

type TractShapData = {
  cancer: TractShapEntry[];
  resp: TractShapEntry[];
};

type ShapByState = Record<string, Record<string, TractShapData>>;

const MANIFEST_URL = "/geojson/manifest.json";
const CARTO_POSITRON =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

type Manifest = {
  states: string[];
  indicators: { value: string; label: string }[];
};

type TractProperties = {
  ID: number;
  ST_ABBREV: string;
  CNTY_NAME: string;
  [key: string]: unknown;
};

type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Geometry, TractProperties>;
type GeoJSONFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, TractProperties>;

function getMinMax(data: GeoJSONFC, field: string): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const f of data.features) {
    const v = f.properties?.[field];
    if (typeof v === "number" && Number.isFinite(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 1;
  if (min === max) max = min + 1;
  return [min, max];
}

function getGeoJSONBounds(
  fc: GeoJSONFC,
): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function addCoord(coord: number[]): void {
    if (
      coord.length >= 2 &&
      typeof coord[0] === "number" &&
      typeof coord[1] === "number"
    ) {
      const [lng, lat] = coord;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }

  function walk(coords: unknown): void {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number") {
        addCoord(coords as number[]);
      } else {
        coords.forEach(walk);
      }
    }
  }

  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === "Point" && g.coordinates) {
      addCoord(g.coordinates);
    } else if (g.type === "Polygon" && g.coordinates) {
      g.coordinates.forEach(walk);
    } else if (g.type === "MultiPolygon" && g.coordinates) {
      g.coordinates.forEach((ring) => ring.forEach(walk));
    }
  }

  if (minLng === Infinity) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function EJScreenMap() {
  const mapRef = useRef<MapRef>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [geoData, setGeoData] = useState<GeoJSONFC | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>(["IN"]);
  const [indicator, setIndicator] = useState<string>("P_PM25");
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    props: TractProperties;
  } | null>(null);
  const [clickedTract, setClickedTract] = useState<{
    x: number;
    y: number;
    props: TractProperties;
  } | null>(null);
  const [shapByState, setShapByState] = useState<ShapByState>({});

  // Load SHAP for the clicked tract's state when needed
  useEffect(() => {
    const state = clickedTract?.props.ST_ABBREV;
    if (!state || shapByState[state] !== undefined) return;
    fetch(`/data/shap/${state}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, TractShapData>) =>
        setShapByState((prev) => ({ ...prev, [state]: data ?? {} })),
      )
      .catch(() => setShapByState((prev) => ({ ...prev, [state]: {} })));
  }, [clickedTract?.props.ST_ABBREV, shapByState]);

  // Load manifest
  useEffect(() => {
    fetch(MANIFEST_URL)
      .then((r) => r.json())
      .then(setManifest)
      .catch(console.error);
  }, []);

  // Load GeoJSON for selected states
  useEffect(() => {
    if (!selectedStates.length) {
      setGeoData(null);
      return;
    }
    const urls = selectedStates.map((s) => `/geojson/${s}.geojson`);
    Promise.all(urls.map((u) => fetch(u).then((r) => r.json())))
      .then((stateData: GeoJSONFC[]) => {
        const combined: GeoJSONFC = {
          type: "FeatureCollection",
          features: stateData.flatMap((fc) => fc.features),
        };
        setGeoData(combined);
      })
      .catch(console.error);
  }, [selectedStates]);

  // When geoData loads, fit map to the selected state(s)
  useEffect(() => {
    if (!geoData?.features?.length || !mapRef.current) return;
    const bounds = getGeoJSONBounds(geoData);
    if (!bounds) return;
    const map = mapRef.current.getMap();
    map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 800 });
  }, [geoData]);

  const fillLayerStyle = useMemo(() => {
    if (!geoData || !geoData.features.length) return undefined;
    const [minVal, maxVal] = getMinMax(geoData, indicator);
    const midVal = (minVal + maxVal) / 2;
    return {
      id: "tracts-fill",
      type: "fill" as const,
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", indicator],
          minVal,
          "#fff5f0",
          midVal,
          "#fc9272",
          maxVal,
          "#67000d",
        ],
        "fill-opacity": 0.7,
      },
    };
  }, [geoData, indicator]);

  const onHover = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (f?.properties) {
      setHoverInfo({
        x: e.point.x,
        y: e.point.y,
        props: f.properties as TractProperties,
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (f?.properties) {
      setClickedTract({
        x: e.point.x,
        y: e.point.y,
        props: f.properties as TractProperties,
      });
    }
  }, []);

  const indicatorOptions = manifest?.indicators ?? [
    { value: "P_PM25", label: "PM 2.5" },
    { value: "P_OZONE", label: "Ozone" },
    { value: "P_CANCER", label: "Cancer Risk" },
    { value: "P_DSLPM", label: "Diesel PM" },
    { value: "P_RESP", label: "Respiratory Hazard" },
    { value: "P_LOWINCPCT", label: "Low Income %" },
    { value: "P_PEOPCOLORPCT", label: "People of Color %" },
  ];
  const stateOptions = manifest?.states ?? [];

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="w-64 shrink-0 border-r bg-white p-4 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            States
          </label>
          <select
            multiple
            value={selectedStates}
            onChange={(e) => {
              const opts = Array.from(e.target.selectedOptions, (o) => o.value);
              setSelectedStates(opts.length ? opts : ["IN"]);
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            size={8}
          >
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Ctrl/Cmd+click to select multiple
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Indicator
          </label>
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {indicatorOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="border-t border-slate-200 pt-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            State Policy Proposal
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Generate a state-level policy recommendation based on county-level
            data. Select exactly one state to enable.
          </p>
          <StateProposalDialog
            stateAbbrev={selectedStates[0] ?? ""}
            disabled={selectedStates.length !== 1}
          />
        </div>
      </aside>
      <div className="flex-1 min-h-[420px] relative z-0 isolate">
        <Map
          ref={mapRef}
          mapStyle={CARTO_POSITRON}
          initialViewState={{
            longitude: -86.1,
            latitude: 40.3,
            zoom: 5,
          }}
          style={{ width: "100%", height: "100%", minHeight: 420 }}
          onMouseMove={onHover}
          onMouseLeave={() => setHoverInfo(null)}
          onClick={onClick}
          interactiveLayerIds={["tracts-fill"]}
          cursor={hoverInfo ? "pointer" : "grab"}
        >
          {geoData && fillLayerStyle && (
            <Source id="tracts" type="geojson" data={geoData}>
              {/* @ts-expect-error MapLibre fill-color expression type is complex */}
              <Layer {...fillLayerStyle} />
            </Source>
          )}
        </Map>
        {hoverInfo && !clickedTract && (
          <div
            className="pointer-events-none absolute z-10 rounded bg-white px-3 py-2 text-sm shadow-lg border border-slate-200"
            style={{ left: hoverInfo.x + 10, top: hoverInfo.y }}
          >
            <div className="font-medium">{hoverInfo.props.CNTY_NAME}</div>
            <div>
              {indicatorOptions.find((o) => o.value === indicator)?.label ??
                indicator}
              :{" "}
              {typeof hoverInfo.props[indicator] === "number"
                ? Number(hoverInfo.props[indicator]).toFixed(1)
                : String(hoverInfo.props[indicator] ?? "—")}
            </div>
          </div>
        )}
        {clickedTract &&
          (() => {
            const state = clickedTract.props.ST_ABBREV;
            const geoid = geoid11(clickedTract.props.ID);
            const tractShap = shapByState[state]?.[geoid];
            return (
              <div
                className="absolute z-20 rounded bg-white px-4 py-3 text-sm shadow-lg border border-slate-200 min-w-[240px] max-w-[320px]"
                style={{ left: clickedTract.x + 10, top: clickedTract.y }}
              >
                <div className="font-medium text-slate-800">
                  {clickedTract.props.CNTY_NAME}
                </div>
                <div className="mt-1 text-slate-600">
                  Tract {String(clickedTract.props.ID)}
                </div>
                {tractShap && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Top drivers — cancer risk
                      </div>
                      <ul className="mt-0.5 text-xs text-slate-700 space-y-0.5">
                        {tractShap.cancer
                          .filter(({ shap }) => shap > 0)
                          .map(({ feature }, i) => (
                            <li key={i} className="text-red-600">
                              {getShapFeatureLabel(feature)} increases risk
                            </li>
                          ))}
                        {tractShap.cancer.every(({ shap }) => shap <= 0) && (
                          <li className="text-slate-500">
                            None of the top factors increase risk in this tract.
                          </li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Top drivers — respiratory risk
                      </div>
                      <ul className="mt-0.5 text-xs text-slate-700 space-y-0.5">
                        {tractShap.resp
                          .filter(({ shap }) => shap > 0)
                          .map(({ feature }, i) => (
                            <li key={i} className="text-red-600">
                              {getShapFeatureLabel(feature)} increases risk
                            </li>
                          ))}
                        {tractShap.resp.every(({ shap }) => shap <= 0) && (
                          <li className="text-slate-500">
                            None of the top factors increase risk in this tract.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                {!tractShap && shapByState[state] !== undefined && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    Driver data not available for this tract.
                  </div>
                )}
                {!tractShap && shapByState[state] === undefined && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    Loading driver data…
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <Link
                    href={`/tract/${geoid11(clickedTract.props.ID)}`}
                    className="inline-block rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    View full details →
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setClickedTract(null)}
                  className="mt-2 block w-full text-left text-xs text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
