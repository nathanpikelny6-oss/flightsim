export const WGS84_A = 6378137;
export const WGS84_F = 1 / 298.257223563;
export const WGS84_E2 = WGS84_F * (2 - WGS84_F);
export const MAX_MERCATOR_LAT = 85.05112878;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function wrapLon(lon: number): number {
  let wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  if (wrapped === -180) wrapped = 180;
  return wrapped;
}

export function tileXToLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return radToDeg(Math.atan(Math.sinh(n)));
}

export function lonToTileX(lon: number, z: number): number {
  return ((wrapLon(lon) + 180) / 360) * 2 ** z;
}

export function latToTileY(lat: number, z: number): number {
  const clamped = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT);
  const rad = degToRad(clamped);
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
}

export function geodeticToEcef(latDeg: number, lonDeg: number, height = 0): {
  x: number;
  y: number;
  z: number;
} {
  const lat = degToRad(latDeg);
  const lon = degToRad(lonDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  return {
    x: (n + height) * cosLat * cosLon,
    y: (n + height) * cosLat * sinLon,
    z: (n * (1 - WGS84_E2) + height) * sinLat,
  };
}

export function ecefToGeodetic(x: number, y: number, z: number): {
  lat: number;
  lon: number;
  height: number;
} {
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  for (let i = 0; i < 5; i += 1) {
    const sinLat = Math.sin(lat);
    const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    const height = p / Math.cos(lat) - n;
    lat = Math.atan2(z, p * (1 - (WGS84_E2 * n) / (n + height)));
  }
  const sinLat = Math.sin(lat);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const height = p / Math.cos(lat) - n;
  return { lat: radToDeg(lat), lon: radToDeg(lon), height };
}

export function geodeticNormal(latDeg: number, lonDeg: number): {
  x: number;
  y: number;
  z: number;
} {
  const lat = degToRad(latDeg);
  const lon = degToRad(lonDeg);
  const cosLat = Math.cos(lat);
  return {
    x: cosLat * Math.cos(lon),
    y: cosLat * Math.sin(lon),
    z: Math.sin(lat),
  };
}

export function eastVector(lonDeg: number): { x: number; y: number; z: number } {
  const lon = degToRad(lonDeg);
  return { x: -Math.sin(lon), y: Math.cos(lon), z: 0 };
}

export function northVector(latDeg: number, lonDeg: number): {
  x: number;
  y: number;
  z: number;
} {
  const lat = degToRad(latDeg);
  const lon = degToRad(lonDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  return {
    x: -sinLat * Math.cos(lon),
    y: -sinLat * Math.sin(lon),
    z: cosLat,
  };
}

export function tileGroundSizeMeters(latDeg: number, z: number): number {
  const cos = Math.max(0.08, Math.cos(degToRad(latDeg)));
  return (Math.cos(0) * 2 * Math.PI * WGS84_A * cos) / 2 ** z;
}

export function destination(lat: number, lon: number, eastMeters: number, northMeters: number): {
  lat: number;
  lon: number;
} {
  const metersPerDegLat = 111132.954 - 559.822 * Math.cos(2 * degToRad(lat));
  const metersPerDegLon = (Math.PI / 180) * WGS84_A * Math.cos(degToRad(lat));
  return {
    lat: clamp(lat + northMeters / metersPerDegLat, -MAX_MERCATOR_LAT + 0.2, MAX_MERCATOR_LAT - 0.2),
    lon: wrapLon(lon + eastMeters / Math.max(1, metersPerDegLon)),
  };
}
