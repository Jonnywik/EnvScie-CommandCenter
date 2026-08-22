export type GeographicBbox = readonly [west: number, south: number, east: number, north: number];

/**
 * A deliberately broad, context-only view covering Balangiga, the Samar landmass,
 * Leyte Gulf, and neighboring Leyte provinces. It is not an administrative boundary.
 */
export const EASTERN_VISAYAS_REGIONAL_BBOX: GeographicBbox = [123.9, 9.7, 126.9, 12.7];

export const BALANGIGA_REFERENCE_POINT = { latitude: 11.11, longitude: 125.39 } as const;

export function isWithinBbox(point: { latitude: number; longitude: number }, bbox: GeographicBbox) {
  const [west, south, east, north] = bbox;
  return point.longitude >= west && point.longitude <= east && point.latitude >= south && point.latitude <= north;
}

/**
 * Returns a display-only Esri World Imagery export URL. Operational state remains
 * sourced from the Command Center APIs and must never be inferred from imagery.
 */
export function esriWorldImageryExportUrl(bbox: GeographicBbox, width: number, height: number) {
  const [west, south, east, north] = bbox;
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${width},${height}`,
    format: "png32",
    transparent: "false",
    f: "image",
  });
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}

export type MapViewportTransform = { x: number; y: number; scale: number };

export type RainViewerTile = {
  x: number;
  y: number;
  z: number;
  url: string;
  west: number;
  south: number;
  east: number;
  north: number;
};

const MAX_MERCATOR_LATITUDE = 85.05112878;

export function clampViewportTransform(
  transform: MapViewportTransform,
  width: number,
  height: number,
  minScale = 0.5,
  maxScale = 8,
): MapViewportTransform {
  const scale = Math.min(maxScale, Math.max(minScale, transform.scale));
  const horizontalSlack = Math.abs(width - width * scale) / 2;
  const verticalSlack = Math.abs(height - height * scale) / 2;
  const minX = scale >= 1 ? width - width * scale : -horizontalSlack;
  const maxX = scale >= 1 ? 0 : horizontalSlack;
  const minY = scale >= 1 ? height - height * scale : -verticalSlack;
  const maxY = scale >= 1 ? 0 : verticalSlack;
  return {
    scale,
    x: Math.min(maxX, Math.max(minX, transform.x)),
    y: Math.min(maxY, Math.max(minY, transform.y)),
  };
}

function lonToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * (2 ** zoom);
}

function latToTileY(latitude: number, zoom: number) {
  const lat = Math.min(MAX_MERCATOR_LATITUDE, Math.max(-MAX_MERCATOR_LATITUDE, latitude));
  const radians = (lat * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * (2 ** zoom);
}

function tileToLongitude(x: number, zoom: number) {
  return (x / (2 ** zoom)) * 360 - 180;
}

function tileToLatitude(y: number, zoom: number) {
  const radians = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (2 ** zoom))));
  return radians * 180 / Math.PI;
}

/** Constructs only the Weather Maps API tiles required to cover a geographic viewport. */
export function rainViewerTilesForBbox(
  bbox: GeographicBbox,
  host: string,
  framePath: string,
  zoom: number,
): RainViewerTile[] {
  const [west, south, east, north] = bbox;
  const dimension = 2 ** zoom;
  const startX = Math.floor(lonToTileX(west, zoom));
  const endX = Math.floor(lonToTileX(east, zoom));
  const startY = Math.floor(latToTileY(north, zoom));
  const endY = Math.floor(latToTileY(south, zoom));
  const base = host.replace(/\/$/, "");
  const path = framePath.startsWith("/") ? framePath : `/${framePath}`;
  const tiles: RainViewerTile[] = [];
  for (let y = Math.max(0, startY); y <= Math.min(dimension - 1, endY); y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const wrappedX = ((x % dimension) + dimension) % dimension;
      tiles.push({
        x: wrappedX,
        y,
        z: zoom,
        url: `${base}${path}/512/${zoom}/${wrappedX}/${y}/4/1_0.png`,
        west: tileToLongitude(x, zoom),
        east: tileToLongitude(x + 1, zoom),
        north: tileToLatitude(y, zoom),
        south: tileToLatitude(y + 1, zoom),
      });
    }
  }
  return tiles;
}
