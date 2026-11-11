import {
  DataTexture,
  Frustum,
  Group,
  Matrix4,
  Mesh,
  RGBAFormat,
  Sphere,
  TextureLoader,
  UnsignedByteType,
  Vector3,
} from "three/webgpu";
import { uniform } from "three/tsl";
import { buildTileGeometry } from "./tileGeometry.ts";
import { configureColorTexture, configureHeightTexture, createTileMaterial } from "./tileMaterial.ts";
import { tileGroundSizeMeters, tileYToLat } from "./wgs84.ts";
import type { PerspectiveCamera } from "three/webgpu";

const IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

export type QualityTier = "mobile" | "desktop";

type TileNode = {
  z: number;
  x: number;
  y: number;
  key: string;
  mesh: Mesh;
  center: Vector3;
  radius: number;
  children: TileNode[] | null;
  colorReady: boolean;
};

function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

function makeRgbaTexture(r: number, g: number, b: number): DataTexture {
  const data = new Uint8Array([r, g, b, 255]);
  const texture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  texture.needsUpdate = true;
  return texture;
}

export class GlobeMap {
  readonly group = new Group();
  readonly exaggeration = uniform(1.7);
  private readonly loader = new TextureLoader();
  private readonly flatHeight: DataTexture;
  private readonly placeholderColor: DataTexture;
  private readonly roots: TileNode[] = [];
  private readonly inflight = new Set<string>();
  private readonly frustum = new Frustum();
  private readonly projView = new Matrix4();
  private readonly sphere = new Sphere();
  private readonly scratch = new Vector3();
  private readonly origin = new Vector3();
  private readonly segments: number;
  private readonly maxZoom: number;
  private readonly splitPixelError: number;
  private tileCount = 0;

  constructor(quality: QualityTier) {
    this.segments = quality === "mobile" ? 24 : 36;
    this.maxZoom = quality === "mobile" ? 12 : 13;
    this.splitPixelError = quality === "mobile" ? 14 : 10;
    this.flatHeight = makeRgbaTexture(128, 0, 0);
    configureHeightTexture(this.flatHeight);
    this.placeholderColor = makeRgbaTexture(12, 32, 54);
    configureColorTexture(this.placeholderColor);
    this.loader.setCrossOrigin("anonymous");

    for (let x = 0; x < 2; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        this.roots.push(this.createNode(1, x, y));
      }
    }
  }

  setExaggeration(value: number): void {
    this.exaggeration.value = value;
  }

  getStats(): { tiles: number } {
    return { tiles: this.tileCount };
  }

  update(camera: PerspectiveCamera, canvasHeight: number, origin: Vector3): void {
    this.origin.copy(origin);
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    this.tileCount = 0;
    for (const root of this.roots) {
      this.updateNode(root, camera, canvasHeight);
    }
  }

  dispose(): void {
    for (const root of this.roots) this.disposeNode(root);
    this.flatHeight.dispose();
    this.placeholderColor.dispose();
  }

  private createNode(z: number, x: number, y: number): TileNode {
    const { geometry, center, radius } = buildTileGeometry(z, x, y, this.segments);
    const material = createTileMaterial(this.placeholderColor, this.flatHeight, this.exaggeration);
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.position.set(center.x, center.y, center.z);
    this.group.add(mesh);

    const node: TileNode = {
      z,
      x,
      y,
      key: tileKey(z, x, y),
      mesh,
      center: new Vector3(center.x, center.y, center.z),
      radius,
      children: null,
      colorReady: false,
    };
    void this.loadTextures(node);
    return node;
  }

  private async loadTextures(node: TileNode): Promise<void> {
    if (this.inflight.has(node.key)) return;
    this.inflight.add(node.key);
    try {
      const [color, height] = await Promise.all([
        this.loader.loadAsync(`${IMAGERY_URL}/${node.z}/${node.y}/${node.x}`),
        this.loader.loadAsync(`/tiles/terrain/${node.z}/${node.x}/${node.y}`).catch(() => this.flatHeight),
      ]);
      configureColorTexture(color);
      if (height !== this.flatHeight) configureHeightTexture(height);
      const previous = node.mesh.material as ReturnType<typeof createTileMaterial>;
      node.mesh.material = createTileMaterial(color, height, this.exaggeration);
      previous.dispose();
      node.colorReady = true;
    } catch {
      node.colorReady = false;
    } finally {
      this.inflight.delete(node.key);
    }
  }

  private updateNode(node: TileNode, camera: PerspectiveCamera, canvasHeight: number): void {
    node.mesh.position.copy(node.center).sub(this.origin);
    this.sphere.center.copy(node.mesh.position);
    this.sphere.radius = node.radius;
    const inView = this.frustum.intersectsSphere(this.sphere);
    if (!inView) {
      this.hideBranch(node);
      return;
    }

    const split = this.shouldSplit(node, camera, canvasHeight);
    if (split && node.z < this.maxZoom) {
      if (!node.children) {
        node.children = this.makeChildren(node);
      }
      const childrenReady = node.children.every((child) => child.colorReady);
      if (childrenReady) {
        this.setVisible(node, false);
        for (const child of node.children) this.updateNode(child, camera, canvasHeight);
        return;
      }
    } else if (node.children && !split) {
      for (const child of node.children) this.hideBranch(child);
    }

    this.setVisible(node, true);
    this.tileCount += 1;
  }

  private makeChildren(node: TileNode): TileNode[] {
    const z = node.z + 1;
    const x = node.x * 2;
    const y = node.y * 2;
    return [
      this.createNode(z, x, y),
      this.createNode(z, x + 1, y),
      this.createNode(z, x, y + 1),
      this.createNode(z, x + 1, y + 1),
    ];
  }

  private shouldSplit(node: TileNode, camera: PerspectiveCamera, canvasHeight: number): boolean {
    const lat = tileYToLat(node.y + 0.5, node.z);
    if (Math.abs(lat) > 84.5) return false;
    this.scratch.copy(node.mesh.position);
    const distance = Math.max(250, camera.position.distanceTo(this.scratch) - node.radius * 0.25);
    const ground = tileGroundSizeMeters(lat, node.z);
    const sse =
      ((ground / 256) * canvasHeight) /
      (distance * 2 * Math.tan((camera.fov * Math.PI) / 360));
    return sse > this.splitPixelError;
  }

  private setVisible(node: TileNode, visible: boolean): void {
    node.mesh.visible = visible;
  }

  private hideBranch(node: TileNode): void {
    this.setVisible(node, false);
    if (!node.children) return;
    for (const child of node.children) this.hideBranch(child);
  }

  private disposeNode(node: TileNode): void {
    if (node.children) {
      for (const child of node.children) this.disposeNode(child);
    }
    (node.mesh.material as ReturnType<typeof createTileMaterial>).dispose();
    node.mesh.geometry.dispose();
    this.group.remove(node.mesh);
  }
}
