import { pollJob, startJob } from "./providers.ts";
import { tooMany } from "./limit.ts";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await req.json();
    if (!value || typeof value !== "object") return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function caller(req: Request): string {
  const forwarded = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "shared";
  return forwarded.split(",")[0]?.trim().slice(0, 80) || "shared";
}

export async function handleVideo(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST a video job." }, 405);
  const body = await readJson(req);
  if (!body) return json({ error: "Send JSON." }, 400);
  const action = String(body.action ?? "");
  const cap = action === "start" ? 6 : 40;
  if (action === "start" || action === "status") {
    if (tooMany(`${action}:${caller(req)}`, cap, 60_000)) {
      return json({ error: "Too many video requests. Wait a minute and try again." }, 429);
    }
  }
  try {
    if (action === "start") {
      const started = await startJob({
        modelId: String(body.model ?? ""),
        prompt: String(body.prompt ?? ""),
        aspect: body.aspect,
        duration: body.duration,
        key: body.key,
        region: body.region,
      });
      return json(started);
    }
    if (action === "status") {
      const polled = await pollJob({
        modelId: String(body.model ?? ""),
        taskId: body.taskId,
        key: body.key,
        region: body.region,
      });
      if ("bytes" in polled) {
        const copy = new ArrayBuffer(polled.bytes.byteLength);
        new Uint8Array(copy).set(polled.bytes);
        return new Response(new Blob([copy], { type: polled.contentType }), {
          headers: {
            "content-type": polled.contentType,
            "cache-control": "no-store",
          },
        });
      }
      return json(polled, polled.state === "failed" ? 502 : 200);
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The video job failed.";
    return json({ error: message }, 400);
  }
}
