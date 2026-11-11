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
import { applyElevation, buildFlatTileGeometry } from "./tileGeometry.ts";
import { configureColorTexture, createTileMaterial } from "./tileMaterial.ts";
import { fetchElevation, type ElevationGrid } from "./elevation.ts";
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
  elevation: ElevationGrid | null;
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
  private exaggeration = 1.1;
  private readonly loader = new TextureLoader();
  private readonly placeholderColor: DataTexture;
  private readonly tiles = new Map<string, TileNode>();
  private readonly inflight = new Set<string>();
  private readonly frustum = new Frustum();
  private readonly projView = new Matrix4();
  private readonly sphere = new Sphere();
  private readonly cameraForward = new Vector3();
  private readonly segments: number;
  private readonly maxZoom: number;
  private readonly sideCap: number;
  private tileCount = 0;

  constructor(quality: QualityTier) {
    this.segments = quality === "mobile" ? 48 : 64;
    this.maxZoom = quality === "mobile" ? 16 : 17;
    this.sideCap = quality === "mobile" ? 7 : 9;
    this.placeholderColor = makeRgbaTexture(92, 124, 92);
    configureColorTexture(this.placeholderColor);
    this.loader.setCrossOrigin("anonymous");
  }

  setExaggeration(value: number): void {
    this.exaggeration = value;
    for (const tile of this.tiles.values()) {
      applyElevation(tile.mesh.geometry, tile.elevation, this.exaggeration);
    }
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
      tile.mesh.position.set(local.east, 0, local.north);
      this.keepTrianglesInFront(tile.mesh, camera);
      this.sphere.center.copy(tile.mesh.position);
      this.sphere.radius = tile.radius;
      const visible = this.frustum.intersectsSphere(this.sphere);
      tile.mesh.visible = visible;
      if (visible) this.tileCount += 1;
    }
  }

  private keepTrianglesInFront(mesh: Mesh, camera: PerspectiveCamera, margin = 8): void {
    const rest = mesh.geometry.getAttribute("rest");
    const position = mesh.geometry.getAttribute("position");
    if (!rest || !position) return;
    camera.getWorldDirection(this.cameraForward);
    const length = Math.hypot(this.cameraForward.x, this.cameraForward.z);
    const forwardX = this.cameraForward.x / (length || 1);
    const forwardZ = this.cameraForward.z / (length || 1);
    const cameraX = camera.position.x;
    const cameraZ = camera.position.z;
    const originX = mesh.position.x;
    const originZ = mesh.position.z;
    for (let i = 0; i < position.count; i += 1) {
      const baseX = rest.getX(i);
      const baseZ = rest.getZ(i);
      const ahead =
        (originX + baseX - cameraX) * forwardX +
        (originZ + baseZ - cameraZ) * forwardZ;
      if (ahead < margin) {
        const push = margin - ahead;
        position.setX(i, baseX + forwardX * push);
        position.setZ(i, baseZ + forwardZ * push);
      } else {
        position.setX(i, baseX);
        position.setZ(i, baseZ);
      }
    }
    position.needsUpdate = true;
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
    const reach = Math.max(range * 8, 2800);
    const viewWidth = 2 * reach * Math.tan((fov * Math.PI) / 360) * Math.max(aspect, 0.6);
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
    const material = createTileMaterial(this.placeholderColor);
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
      elevation: null,
    };
    void this.loadTextures(node);
    return node;
  }

  private async loadTextures(node: TileNode): Promise<void> {
    if (this.inflight.has(node.key)) return;
    this.inflight.add(node.key);
    try {
      const [color, elevation] = await Promise.all([
        this.loader.loadAsync(`${IMAGERY_URL}/${node.z}/${node.y}/${node.x}`),
        fetchElevation(node.z, node.x, node.y).catch(() => null),
      ]);
      if (!this.tiles.has(node.key)) {
        color.dispose();
        return;
      }
      configureColorTexture(color);
      const previous = node.mesh.material as ReturnType<typeof createTileMaterial>;
      node.mesh.material = createTileMaterial(color);
      previous.dispose();
      node.elevation = elevation;
      applyElevation(node.mesh.geometry, elevation, this.exaggeration);
    } catch {
      node.mesh.visible = false;
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
