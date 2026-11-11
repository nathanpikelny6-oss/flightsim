import type { Config, Context } from "@netlify/functions";

const TERRAIN_ORIGIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const MAX_ZOOM = 15;

function parseTile(zRaw: string | undefined, xRaw: string | undefined, yRaw: string | undefined) {
  const z = Number(zRaw);
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isInteger(z) || z < 0 || z > MAX_ZOOM) return null;
  const span = 2 ** z;
  if (!Number.isInteger(x) || x < 0 || x >= span) return null;
  if (!Number.isInteger(y) || y < 0 || y >= span) return null;
  return { z, x, y };
}

export default async (req: Request, context: Context) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const params = context.params as { z?: string; x?: string; y?: string };
  const fromParams = parseTile(params.z, params.x, params.y);
  const path = new URL(req.url).pathname;
  const match = path.match(/\/tiles\/terrain\/(\d+)\/(\d+)\/(\d+)/);
  const tile = fromParams ?? (match ? parseTile(match[1], match[2], match[3]) : null);
  if (!tile) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(`${TERRAIN_ORIGIN}/${tile.z}/${tile.x}/${tile.y}.png`);
  if (!upstream.ok) {
    return new Response("Tile unavailable", { status: upstream.status });
  }

  return new Response(req.method === "HEAD" ? null : await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
};

export const config: Config = {
  path: "/tiles/terrain/:z/:x/:y",
};
