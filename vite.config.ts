import { defineConfig, type Plugin, type ViteDevServer } from "vite";

const TERRAIN_ORIGIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

function parseTerrainPath(url: string): { z: number; x: number; y: number } | null {
  const path = url.split("?")[0] ?? "";
  const match = path.match(/^\/tiles\/terrain\/(\d+)\/(\d+)\/(\d+)(?:\.png)?$/);
  if (!match) return null;
  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (!Number.isInteger(z) || z < 0 || z > 15) return null;
  const span = 2 ** z;
  if (!Number.isInteger(x) || x < 0 || x >= span) return null;
  if (!Number.isInteger(y) || y < 0 || y >= span) return null;
  return { z, x, y };
}

async function proxyTerrain(reqUrl: string, res: import("http").ServerResponse): Promise<boolean> {
  const tile = parseTerrainPath(reqUrl);
  if (!tile) return false;
  const upstream = await fetch(`${TERRAIN_ORIGIN}/${tile.z}/${tile.x}/${tile.y}.png`);
  if (!upstream.ok) {
    res.statusCode = upstream.status;
    res.end();
    return true;
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(body);
  return true;
}

function attachTileProxy(server: ViteDevServer): void {
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? "";
    if (!url.startsWith("/tiles/terrain/")) {
      next();
      return;
    }
    void proxyTerrain(url, res).then((handled) => {
      if (!handled) next();
    }).catch(next);
  });
}

function terrainProxy(): Plugin {
  return {
    name: "terrain-tile-proxy",
    configureServer: attachTileProxy,
    configurePreviewServer: attachTileProxy,
  };
}

export default defineConfig({
  plugins: [terrainProxy()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
