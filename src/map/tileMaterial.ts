import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicNodeMaterial,
  NoColorSpace,
  SRGBColorSpace,
  Texture,
} from "three/webgpu";
import { attribute, float, normalLocal, positionLocal, texture, uniform, uv } from "three/tsl";

export type HeightScale = ReturnType<typeof uniform>;

export function configureColorTexture(map: Texture): void {
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter;
  map.wrapS = ClampToEdgeWrapping;
  map.wrapT = ClampToEdgeWrapping;
  map.needsUpdate = true;
}

export function configureHeightTexture(map: Texture): void {
  map.colorSpace = NoColorSpace;
  map.generateMipmaps = false;
  map.minFilter = LinearFilter;
  map.magFilter = LinearFilter;
  map.wrapS = ClampToEdgeWrapping;
  map.wrapT = ClampToEdgeWrapping;
  map.needsUpdate = true;
}

export function createTileMaterial(
  colorMap: Texture,
  heightMap: Texture,
  exaggeration: HeightScale,
): MeshBasicNodeMaterial {
  const texel = texture(heightMap, uv());
  const meters = texel.r
    .mul(float(65280))
    .add(texel.g.mul(float(255)))
    .add(texel.b.mul(float(0.99609375)))
    .sub(float(32768));
  const skirt = attribute("skirt", "float");
  const scale = exaggeration as unknown as ReturnType<typeof float>;
  const displacement = meters.mul(scale).sub(skirt.mul(float(1800)));

  const material = new MeshBasicNodeMaterial();
  material.colorNode = texture(colorMap, uv());
  material.positionNode = positionLocal.add(normalLocal.mul(displacement));
  material.fog = false;
  return material;
}
