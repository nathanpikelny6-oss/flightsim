import { adoptPlan, planReel, PlanError, type PlanInput } from "./plan.ts";
import { pollJob, startJob } from "./providers.ts";

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

function planInput(body: Record<string, unknown>): PlanInput {
  return {
    prompt: String(body.prompt ?? ""),
    formatId: String(body.formatId ?? ""),
    duration: Number(body.duration ?? 6),
    aspect: String(body.aspect ?? "9:16"),
    edit: String(body.edit ?? "punch"),
  };
}

function gatewayReady(): boolean {
  const runtime = globalThis as { Netlify?: { env?: { get?: (name: string) => string | undefined } } };
  const read = (name: string) => runtime.Netlify?.env?.get?.(name) || process.env[name];
  return Boolean(read("GEMINI_API_KEY") || read("NETLIFY_AI_GATEWAY_KEY") || read("GOOGLE_GEMINI_BASE_URL"));
}

async function refine(local: ReturnType<typeof planReel>): Promise<{ plan: ReturnType<typeof planReel>; source: string }> {
  if (!gatewayReady()) return { plan: local, source: "reelroom" };
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({});
    const count = local.shots.length;
    const instruction = [
      `Write a ${local.duration}-second ${local.aspect} video shot list.`,
      `Format: ${local.formatName}. ${local.audio}`,
      `Subject, in the user's words: ${JSON.stringify(local.subject)}`,
      `Return JSON with title, hook, caption, hashtags (4 short words, no #), audio, and shots (exactly ${count} objects with kicker, line, detail).`,
      "line is under 42 characters. detail is under 90 characters. Use the subject's real nouns.",
      "Do not invent prices, stats, or quotes. Do not mention being a model.",
    ].join("\n");
    const pending = ai.models
      .generateContent({
        model: "gemini-2.5-flash",
        contents: instruction,
        config: { responseMimeType: "application/json" },
      })
      .then((response) => response.text ?? "")
      .catch(() => "");
    const text = await Promise.race([
      pending,
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000)),
    ]);
    if (!text.trim()) return { plan: local, source: "reelroom" };
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    return { plan: adoptPlan(local, parsed), source: "gemini-2.5-flash" };
  } catch {
    return { plan: local, source: "reelroom" };
  }
}

export async function handlePlan(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST a prompt." }, 405);
  const body = await readJson(req);
  if (!body) return json({ error: "Send JSON." }, 400);
  try {
    const input = planInput(body);
    const local = planReel(input);
    const refined = await refine(local);
    return json({ source: refined.source, plan: refined.plan });
  } catch (error) {
    if (error instanceof PlanError) return json({ error: error.message }, 400);
    return json({ error: "Couldn't write that cut." }, 500);
  }
}

export async function handleVideo(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST a video job." }, 405);
  const body = await readJson(req);
  if (!body) return json({ error: "Send JSON." }, 400);
  const action = String(body.action ?? "");
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
