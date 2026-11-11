import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
} from "three/webgpu";
import { geodeticNormal, geodeticToEcef, tileXToLon, tileYToLat } from "./wgs84.ts";

export function buildTileGeometry(z: number, x: number, y: number, segments: number): {
  geometry: BufferGeometry;
  center: { x: number; y: number; z: number };
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
  const center = geodeticToEcef(centerLat, centerLon, 0);
  let maxRadius = 0;

  for (let row = 0; row < dim; row += 1) {
    for (let col = 0; col < dim; col += 1) {
      const isSkirt = col === 0 || row === 0 || col === dim - 1 || row === dim - 1;
      const u = Math.min(1, Math.max(0, (col - 1) / segments));
      const v = Math.min(1, Math.max(0, (row - 1) / segments));
      const lon = tileXToLon(x + u, z);
      const lat = tileYToLat(y + v, z);
      const ecef = geodeticToEcef(lat, lon, 0);
      const normal = geodeticNormal(lat, lon);
      const index = row * dim + col;
      const dx = ecef.x - center.x;
      const dy = ecef.y - center.y;
      const dz = ecef.z - center.z;
      positions[index * 3] = dx;
      positions[index * 3 + 1] = dy;
      positions[index * 3 + 2] = dz;
      normals[index * 3] = normal.x;
      normals[index * 3 + 1] = normal.y;
      normals[index * 3 + 2] = normal.z;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = 1 - v;
      skirts[index] = isSkirt ? 1 : 0;
      const radius = Math.hypot(dx, dy, dz);
      if (radius > maxRadius) maxRadius = radius;
    }
  }

  const indexCount = (dim - 1) * (dim - 1) * 6;
  const indices = new Uint32Array(indexCount);
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

  return { geometry, center, radius: maxRadius * 1.15 };
}
