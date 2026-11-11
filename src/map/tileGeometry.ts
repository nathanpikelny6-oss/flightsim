import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
} from "three/webgpu";
import { offsetMeters, tileXToLon, tileYToLat } from "./wgs84.ts";

export function buildFlatTileGeometry(z: number, x: number, y: number, segments: number): {
  geometry: BufferGeometry;
  centerLat: number;
  centerLon: number;
  radius: number;
} {
  const dim = segments + 3;
  const vertexCount = dim * dim;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const skirts = new Float32Array(vertexCount);
  const centerLat = tileYToLat(y + 0.5, z);
  const centerLon = tileXToLon(x + 0.5, z);
  let maxRadius = 0;

  for (let row = 0; row < dim; row += 1) {
    for (let col = 0; col < dim; col += 1) {
      const isSkirt = col === 0 || row === 0 || col === dim - 1 || row === dim - 1;
      const u = Math.min(1, Math.max(0, (col - 1) / segments));
      const v = Math.min(1, Math.max(0, (row - 1) / segments));
      const lon = tileXToLon(x + u, z);
      const lat = tileYToLat(y + v, z);
      const local = offsetMeters(centerLat, centerLon, lat, lon);
      const index = row * dim + col;
      positions[index * 3] = local.east;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = local.north;
      normals[index * 3 + 1] = 1;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = 1 - v;
      skirts[index] = isSkirt ? 1 : 0;
      maxRadius = Math.max(maxRadius, Math.hypot(local.east, local.north));
    }
  }

  const indices = new Uint32Array((dim - 1) * (dim - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < dim - 1; row += 1) {
    for (let col = 0; col < dim - 1; col += 1) {
      const a = row * dim + col;
      const b = a + 1;
      const c = a + dim;
      const d = c + 1;
      indices[cursor++] = a;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = d;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skirt", new Float32BufferAttribute(skirts, 1));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return { geometry, centerLat, centerLon, radius: maxRadius * 1.05 };
}
