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
} from "three/webgpu";
import { uniform } from "three/tsl";
import { buildFlatTileGeometry } from "./tileGeometry.ts";
import { configureColorTexture, configureHeightTexture, createTileMaterial } from "./tileMaterial.ts";
import { fetchElevationTexture } from "./elevation.ts";
import { latToTileY, lonToTileX, offsetMeters, tileGroundSizeMeters } from "./wgs84.ts";
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
  centerLat: number;
  centerLon: number;
  radius: number;
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

export class TerrainMap {
  readonly group = new Group();
  readonly exaggeration = uniform(1.1);
  private readonly loader = new TextureLoader();
  private readonly flatHeight: DataTexture;
  private readonly placeholderColor: DataTexture;
  private readonly tiles = new Map<string, TileNode>();
  private readonly inflight = new Set<string>();
  private readonly frustum = new Frustum();
  private readonly projView = new Matrix4();
  private readonly sphere = new Sphere();
  private readonly segments: number;
  private readonly maxZoom: number;
  private readonly sideCap: number;
  private tileCount = 0;

  constructor(quality: QualityTier) {
    this.segments = quality === "mobile" ? 32 : 48;
    this.maxZoom = quality === "mobile" ? 16 : 17;
    this.sideCap = quality === "mobile" ? 5 : 7;
    this.flatHeight = makeRgbaTexture(128, 0, 0);
    configureHeightTexture(this.flatHeight);
    this.placeholderColor = makeRgbaTexture(92, 124, 92);
    configureColorTexture(this.placeholderColor);
    this.loader.setCrossOrigin("anonymous");
  }

  setExaggeration(value: number): void {
    this.exaggeration.value = value;
  }

  getStats(): { tiles: number } {
    return { tiles: this.tileCount };
  }

  update(
    camera: PerspectiveCamera,
    lat: number,
    lon: number,
    range: number,
  ): void {
    const zoom = this.zoomForRange(range);
    const wanted = new Set<string>();
    this.cover(zoom, lat, lon, range, camera.aspect, camera.fov, this.sideCap, wanted);
    this.cover(Math.max(6, zoom - 3), lat, lon, range, camera.aspect, camera.fov, 3, wanted);
    for (const key of wanted) {
      if (!this.tiles.has(key)) {
        const [z, x, y] = key.split("/").map(Number);
        this.tiles.set(key, this.createNode(z, x, y));
      }
    }
    for (const [key, tile] of this.tiles) {
      if (!wanted.has(key)) this.disposeTile(key, tile);
    }

    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    this.tileCount = 0;
    for (const tile of this.tiles.values()) {
      const local = offsetMeters(lat, lon, tile.centerLat, tile.centerLon);
      tile.mesh.position.set(local.east, tile.z === zoom ? 1 : 0, local.north);
      this.sphere.center.copy(tile.mesh.position);
      this.sphere.radius = tile.radius;
      const visible = tile.colorReady && this.frustum.intersectsSphere(this.sphere);
      tile.mesh.visible = visible;
      if (visible) this.tileCount += 1;
    }
  }

  private zoomForRange(range: number): number {
    const zoom = Math.round(Math.log2(28_000_000 / Math.max(80, range)));
    return Math.min(this.maxZoom, Math.max(8, zoom));
  }

  private cover(
    z: number,
    lat: number,
    lon: number,
    range: number,
    aspect: number,
    fov: number,
    cap: number,
    wanted: Set<string>,
  ): void {
    const tileSize = Math.max(40, tileGroundSizeMeters(lat, z));
    const viewWidth = 2 * range * Math.tan((fov * Math.PI) / 360) * Math.max(aspect, 0.6);
    const span = Math.min(cap, Math.max(3, Math.ceil(viewWidth / tileSize) + 2));
    const half = Math.floor(span / 2);
    const cx = Math.floor(lonToTileX(lon, z));
    const cy = Math.floor(latToTileY(lat, z));
    const limit = 2 ** z;
    for (let y = cy - half; y <= cy + half; y += 1) {
      if (y < 0 || y >= limit) continue;
      for (let x = cx - half; x <= cx + half; x += 1) {
        const wrapped = ((x % limit) + limit) % limit;
        wanted.add(tileKey(z, wrapped, y));
      }
    }
  }

  private createNode(z: number, x: number, y: number): TileNode {
    const { geometry, centerLat, centerLon, radius } = buildFlatTileGeometry(z, x, y, this.segments);
    const material = createTileMaterial(this.placeholderColor, this.flatHeight, this.exaggeration);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.group.add(mesh);
    const node: TileNode = {
      z,
      x,
      y,
      key: tileKey(z, x, y),
      mesh,
      centerLat,
      centerLon,
      radius,
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
        fetchElevationTexture(node.z, node.x, node.y).catch(() => this.flatHeight),
      ]);
      if (!this.tiles.has(node.key)) {
        color.dispose();
        if (height !== this.flatHeight) height.dispose();
        return;
      }
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

  private disposeTile(key: string, tile: TileNode): void {
    this.tiles.delete(key);
    (tile.mesh.material as ReturnType<typeof createTileMaterial>).dispose();
    tile.mesh.geometry.dispose();
    this.group.remove(tile.mesh);
  }
}
