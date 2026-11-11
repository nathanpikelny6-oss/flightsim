import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  SRGBColorSpace,
  Texture,
} from "three/webgpu";

export function configureColorTexture(map: Texture): void {
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 16;
  map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter;
  map.wrapS = ClampToEdgeWrapping;
  map.wrapT = ClampToEdgeWrapping;
  map.needsUpdate = true;
}

export function createTileMaterial(colorMap: Texture): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ map: colorMap });
  material.fog = false;
  return material;
}