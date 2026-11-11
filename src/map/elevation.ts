import * as Lerc from "lerc";
import lercWasm from "lerc/lerc-wasm.wasm?url";

const ELEVATION_URL =
  "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/tile";

const ready = Lerc.load({
  locateFile: () => lercWasm,
});

export type ElevationGrid = {
  samples: Float32Array;
  width: number;
  height: number;
};

export async function fetchElevation(z: number, x: number, y: number): Promise<ElevationGrid> {
  await ready;
  const response = await fetch(`${ELEVATION_URL}/${z}/${y}/${x}`);
  if (!response.ok) throw new Error(`Elevation tile ${z}/${x}/${y} failed`);
  const decoded = Lerc.decode(new Uint8Array(await response.arrayBuffer()));
  const band = decoded.pixels[0];
  if (!band) throw new Error("Elevation tile had no heights");
  const samples = new Float32Array(band.length);
  for (let i = 0; i < band.length; i += 1) {
    const meters = band[i] ?? 0;
    const missing = (decoded.mask && decoded.mask[i] === 0) || !Number.isFinite(meters) || meters < -500 || meters > 9000;
    samples[i] = missing ? 0 : meters;
  }
  return { samples, width: decoded.width, height: decoded.height };
}
