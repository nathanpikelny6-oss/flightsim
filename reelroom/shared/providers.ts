import { modelById, type ModelSpec } from "./models.ts";
import {
  allowedVideoUrl,
  cleanKey,
  cleanRegion,
  endpoint,
  plainTaskId,
  safeText,
  veoOperation,
} from "./guards.ts";
import type { Aspect } from "./plan.ts";

export type StartResult = { taskId: string };
export type PollResult =
  | { state: "running"; message: string }
  | { state: "failed"; message: string }
  | { state: "done"; bytes: Uint8Array; contentType: string }
  | { state: "done"; videoUrl: string };

type Job = {
  model: ModelSpec;
  prompt: string;
  aspect: Aspect;
  duration: number;
  key: string;
  region: "intl" | "cn";
};

const MAX_BYTES = 18 * 1024 * 1024;

function asAspect(value: unknown): Aspect {
  if (value === "16:9" || value === "1:1" || value === "9:16") return value;
  return "9:16";
}

function veoSeconds(duration: number): "4" | "6" | "8" {
  if (duration <= 5) return "4";
  if (duration <= 7) return "6";
  return "8";
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function readBody(response: Response, key: string): Promise<{ json: Record<string, unknown> | null; text: string }> {
  const text = await response.text();
  try {
    return { json: record(JSON.parse(text)), text: safeText(text, key) };
  } catch {
    return { json: null, text: safeText(text, key) };
  }
}

function failure(response: Response, text: string): PollResult {
  const reason = text || `The provider returned ${response.status}.`;
  if (response.status === 401 || response.status === 403) {
    return { state: "failed", message: "That key was rejected by the provider." };
  }
  return { state: "failed", message: reason };
}

function findUrl(value: unknown, depth = 0): string | null {
  if (depth > 8 || !value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const row = value as Record<string, unknown>;
  for (const key of ["videoUrl", "video_url", "uri", "url"]) {
    const candidate = row[key];
    if (typeof candidate === "string" && candidate.startsWith("https://")) return candidate;
  }
  for (const key of ["video", "output", "content", "response", "generateVideoResponse", "generatedSamples", "generatedVideos", "data"]) {
    const found = findUrl(row[key], depth + 1);
    if (found) return found;
  }
  return null;
}

async function fetchAllowed(url: URL, headers: HeadersInit, key: string, hops = 0): Promise<PollResult> {
  if (hops > 3) return { state: "failed", message: "The download redirected too many times." };
  const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(20000) });
  if (response.status >= 300 && response.status < 400) {
    const next = response.headers.get("location");
    if (!next) return { state: "failed", message: "The download redirect was empty." };
    const resolved = allowedVideoUrl(new URL(next, url).toString());
    if (!resolved) return { state: "failed", message: "The video moved to a host this site won't fetch." };
    return fetchAllowed(resolved, headers, key, hops + 1);
  }
  if (!response.ok) {
    const body = await readBody(response, key);
    return failure(response, body.text);
  }
  const type = response.headers.get("content-type") || "video/mp4";
  if (!type.startsWith("video/") && type !== "application/octet-stream") {
    return { state: "failed", message: "The provider did not return a video file." };
  }
  const length = Number(response.headers.get("content-length") || "0");
  if (length > MAX_BYTES) return { state: "done", videoUrl: url.toString() };
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return { state: "done", videoUrl: url.toString() };
  return { state: "done", bytes, contentType: type.startsWith("video/") ? type : "video/mp4" };
}

async function deliver(rawUrl: string, headers: HeadersInit, key: string): Promise<PollResult> {
  const url = allowedVideoUrl(rawUrl);
  if (!url) return { state: "failed", message: "The video is ready, but its host isn't one this site will download." };
  try {
    return await fetchAllowed(url, headers, key);
  } catch {
    return { state: "done", videoUrl: url.toString() };
  }
}

export async function startJob(input: {
  modelId: string;
  prompt: string;
  aspect: unknown;
  duration: unknown;
  key: unknown;
  region: unknown;
}): Promise<StartResult> {
  const model = modelById(input.modelId);
  if (!model?.provider || !model.providerModel) {
    throw new Error("That model isn't called from this site. Use the free cut.");
  }
  const key = cleanKey(input.key);
  if (!key) throw new Error(`Add a key for ${model.name}. The free cut does not need one.`);
  const prompt = typeof input.prompt === "string" ? input.prompt.replace(/\s+/g, " ").trim() : "";
  if (prompt.length < 3 || prompt.length > 2000) throw new Error("The prompt needs to be between 3 and 2000 characters.");
  const job: Job = {
    model,
    prompt,
    aspect: asAspect(input.aspect),
    duration: Math.max(4, Math.min(15, Number(input.duration) || 6)),
    key,
    region: cleanRegion(input.region),
  };
  if (model.provider === "gemini") return startVeo(job);
  if (model.provider === "dashscope") return startWan(job);
  return startSeedance(job);
}

export async function pollJob(input: {
  modelId: string;
  taskId: unknown;
  key: unknown;
  region: unknown;
}): Promise<PollResult> {
  const model = modelById(input.modelId);
  if (!model?.provider) throw new Error("Unknown model.");
  const key = cleanKey(input.key);
  if (!key) throw new Error("The key was missing on the status check.");
  const region = cleanRegion(input.region);
  const taskId = typeof input.taskId === "string" ? input.taskId : "";
  if (model.provider === "gemini") return pollVeo(taskId, key);
  if (model.provider === "dashscope") return pollWan(taskId, key, region);
  return pollSeedance(taskId, key, region);
}

async function startVeo(job: Job): Promise<StartResult> {
  const aspect = job.aspect === "16:9" ? "16:9" : "9:16";
  const response = await fetch(`${endpoint("gemini", "intl")}/v1beta/models/${job.model.providerModel}:predictLongRunning`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": job.key,
    },
    body: JSON.stringify({
      instances: [{ prompt: job.prompt }],
      parameters: {
        aspectRatio: aspect,
        durationSeconds: veoSeconds(job.duration),
        resolution: "720p",
        personGeneration: "allow_all",
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await readBody(response, job.key);
  if (!response.ok || !body.json) throw new Error(body.text || "Veo didn't start.");
  const name = typeof body.json.name === "string" ? body.json.name : "";
  if (!veoOperation(name)) throw new Error(body.text || "Veo didn't return a job id.");
  return { taskId: name };
}

async function pollVeo(taskId: string, key: string): Promise<PollResult> {
  const operation = veoOperation(taskId);
  if (!operation) return { state: "failed", message: "That Veo job id is not valid." };
  const response = await fetch(`${endpoint("gemini", "intl")}/v1beta/${operation}`, {
    headers: { "x-goog-api-key": key },
    signal: AbortSignal.timeout(20000),
  });
  const body = await readBody(response, key);
  if (!response.ok || !body.json) return failure(response, body.text);
  const error = record(body.json.error);
  if (error) return { state: "failed", message: safeText(String(error.message || "Veo rejected the prompt."), key) };
  if (body.json.done !== true) return { state: "running", message: "Veo is still rendering." };
  const uri = findUrl(body.json.response);
  if (!uri) return { state: "failed", message: "Veo finished without a video." };
  return deliver(uri, { "x-goog-api-key": key }, key);
}

function wanSize(aspect: Aspect): string {
  if (aspect === "16:9") return "1280*720";
  if (aspect === "1:1") return "960*960";
  return "720*1280";
}

async function startWan(job: Job): Promise<StartResult> {
  const response = await fetch(`${endpoint("dashscope", job.region)}/api/v1/services/aigc/video-generation/video-synthesis`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${job.key}`,
      "content-type": "application/json",
      "x-dashscope-async": "enable",
    },
    body: JSON.stringify({
      model: job.model.providerModel,
      input: { prompt: job.prompt },
      parameters: {
        size: wanSize(job.aspect),
        duration: job.duration <= 6 ? 5 : 10,
        prompt_extend: true,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await readBody(response, job.key);
  const output = record(body.json?.output);
  const taskId = typeof output?.task_id === "string" ? output.task_id : "";
  if (!response.ok || !plainTaskId(taskId)) throw new Error(body.text || "Wan didn't start.");
  return { taskId };
}

async function pollWan(taskId: string, key: string, region: "intl" | "cn"): Promise<PollResult> {
  const id = plainTaskId(taskId);
  if (!id) return { state: "failed", message: "That Wan job id is not valid." };
  const response = await fetch(`${endpoint("dashscope", region)}/api/v1/tasks/${id}`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
  });
  const body = await readBody(response, key);
  if (!response.ok || !body.json) return failure(response, body.text);
  const output = record(body.json.output);
  const status = String(output?.task_status || "").toUpperCase();
  if (status === "FAILED" || status === "UNKNOWN" || status === "CANCELED") {
    return { state: "failed", message: safeText(String(output?.message || output?.code || "Wan failed."), key) };
  }
  if (status !== "SUCCEEDED") return { state: "running", message: "Wan is still rendering." };
  const uri = findUrl(output);
  if (!uri) return { state: "failed", message: "Wan finished without a video." };
  return deliver(uri, {}, key);
}

async function startSeedance(job: Job): Promise<StartResult> {
  const ratio = job.aspect === "16:9" ? "16:9" : job.aspect === "1:1" ? "1:1" : "9:16";
  const response = await fetch(`${endpoint("ark", job.region)}/api/v3/contents/generations/tasks`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${job.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: job.model.providerModel,
      content: [{ type: "text", text: job.prompt }],
      ratio,
      duration: Math.max(4, Math.min(15, Math.round(job.duration))),
      resolution: "720p",
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await readBody(response, job.key);
  const taskId = typeof body.json?.id === "string" ? body.json.id : "";
  if (!response.ok || !plainTaskId(taskId)) throw new Error(body.text || "Seedance didn't start.");
  return { taskId };
}

async function pollSeedance(taskId: string, key: string, region: "intl" | "cn"): Promise<PollResult> {
  const id = plainTaskId(taskId);
  if (!id) return { state: "failed", message: "That Seedance job id is not valid." };
  const response = await fetch(`${endpoint("ark", region)}/api/v3/contents/generations/tasks/${id}`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
  });
  const body = await readBody(response, key);
  if (!response.ok || !body.json) return failure(response, body.text);
  const status = String(body.json.status || "").toLowerCase();
  if (status === "failed" || status === "cancelled" || status === "expired") {
    const error = record(body.json.error);
    return { state: "failed", message: safeText(String(error?.message || body.json.message || "Seedance failed."), key) };
  }
  if (status !== "succeeded" && status !== "success") {
    return { state: "running", message: "Seedance is still rendering." };
  }
  const uri = findUrl(body.json);
  if (!uri) return { state: "failed", message: "Seedance finished without a video." };
  return deliver(uri, {}, key);
}
