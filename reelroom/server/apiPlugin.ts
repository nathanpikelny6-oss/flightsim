import type { IncomingMessage } from "node:http";
import type { Connect, Plugin, PreviewServer, ViteDevServer } from "vite";
import { handleVideo } from "../shared/http.ts";

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function attach(server: ViteDevServer | PreviewServer): void {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];
    if (path !== "/api/video") {
      next();
      return;
    }
    try {
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const request = new Request(`http://reelroom.local${req.url ?? path}`, {
        method: req.method,
        headers: { "content-type": String(req.headers["content-type"] ?? "application/json") },
        body: body && body.length > 0 ? new Uint8Array(body) : undefined,
      });
      const response = await handleVideo(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        if (key === "content-encoding") return;
        res.setHeader(key, value);
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      res.end(bytes);
    } catch (error) {
      next(error);
    }
  };
  server.middlewares.use(middleware);
}

export function apiPlugin(): Plugin {
  return {
    name: "reelroom-api",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
