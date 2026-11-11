import {
  BackSide,
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  SphereGeometry,
} from "three/webgpu";
import { abs, cameraPosition, dot, float, normalWorld, positionWorld, pow, vec3 } from "three/tsl";
import { WGS84_A } from "./wgs84.ts";

export function createAtmosphere(): Mesh {
  const geometry = new SphereGeometry(WGS84_A * 1.045, 64, 48);
  const material = new MeshBasicNodeMaterial();
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const fresnel = pow(float(1).sub(abs(dot(viewDir, normalWorld))), float(2.4));
  material.colorNode = vec3(0.28, 0.52, 1).mul(fresnel.mul(float(1.35)));
  material.opacityNode = fresnel.mul(float(0.72));
  material.transparent = true;
  material.side = BackSide;
  material.depthWrite = false;
  material.fog = false;
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

export function createStarfield(): Mesh {
  const geometry = new SphereGeometry(WGS84_A * 12, 32, 24);
  const material = new MeshBasicNodeMaterial();
  material.color = new Color("#02040a");
  material.side = BackSide;
  material.depthWrite = false;
  material.fog = false;
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return mesh;
}
