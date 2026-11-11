import { DataTexture, RGBAFormat, UnsignedByteType, type Texture } from "three/webgpu";
import * as Lerc from "lerc";
import lercWasm from "lerc/lerc-wasm.wasm?url";
import { configureHeightTexture } from "./tileMaterial.ts";

const ELEVATION_URL =
  "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/tile";

const ready = Lerc.load({
  locateFile: () => lercWasm,
});

function encodeTerrarium(pixels: ArrayLike<number>, mask: Uint8Array | null, width: number, height: number): Texture {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    let meters = pixels[i] ?? 0;
    if ((mask && mask[i] === 0) || !Number.isFinite(meters) || meters < -500 || meters > 9000) meters = 0;
    const scaled = Math.min(0xffffff, Math.max(0, Math.round((meters + 32768) * 256)));
    const offset = i * 4;
    data[offset] = (scaled >> 16) & 255;
    data[offset + 1] = (scaled >> 8) & 255;
    data[offset + 2] = scaled & 255;
    data[offset + 3] = 255;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  configureHeightTexture(texture);
  return texture;
}

export async function fetchElevationTexture(z: number, x: number, y: number): Promise<Texture> {
  await ready;
  const response = await fetch(`${ELEVATION_URL}/${z}/${y}/${x}`);
  if (!response.ok) throw new Error(`Elevation tile ${z}/${x}/${y} failed`);
  const decoded = Lerc.decode(new Uint8Array(await response.arrayBuffer()));
  const band = decoded.pixels[0];
  if (!band) throw new Error("Elevation tile had no heights");
  return encodeTerrarium(band, decoded.mask, decoded.width, decoded.height);
}
