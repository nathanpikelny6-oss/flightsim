import { adoptPlan, planReel, type PlanInput, type ReelPlan } from "../shared/plan.ts";
import type { ModelSpec } from "../shared/models.ts";

export async function loadPlan(input: PlanInput): Promise<{ plan: ReelPlan; source: string }> {
  const local = planReel(input);
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return { plan: local, source: "reelroom" };
    const data = (await response.json()) as { source?: string; plan?: unknown };
    return {
      plan: adoptPlan(local, data.plan),
      source: data.source === "gemini-2.5-flash" ? data.source : "reelroom",
    };
  } catch {
    return { plan: local, source: "reelroom" };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runProvider(
  input: {
    model: ModelSpec;
    prompt: string;
    aspect: string;
    duration: number;
    key: string;
    region: string;
  },
  onStatus: (message: string) => void,
): Promise<Blob> {
  const response = await fetch("/api/video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "start",
      model: input.model.id,
      prompt: input.prompt,
      aspect: input.aspect,
      duration: input.duration,
      key: input.key,
      region: input.region,
    }),
  });
  const started = (await response.json()) as { taskId?: string; error?: string };
  if (!response.ok || !started.taskId) throw new Error(started.error || "The model didn't start.");

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (attempt > 0) await sleep(4000);
    onStatus(attempt === 0 ? `Queued with ${input.model.name}` : `${input.model.name} is rendering`);
    const status = await fetch("/api/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "status",
        model: input.model.id,
        taskId: started.taskId,
        key: input.key,
        region: input.region,
      }),
    });
    const type = status.headers.get("content-type") || "";
    if (type.startsWith("video/")) {
      if (!status.ok) throw new Error("The video download failed.");
      return status.blob();
    }
    const data = (await status.json()) as { state?: string; message?: string; error?: string; videoUrl?: string };
    if (!status.ok || data.state === "failed") throw new Error(data.error || data.message || "The model failed.");
    if (data.message) onStatus(data.message);
    if (data.state === "done" && data.videoUrl && data.videoUrl.startsWith("https://")) {
      const file = await fetch(data.videoUrl);
      if (!file.ok) throw new Error("The provider video didn't load.");
      return file.blob();
    }
  }
  throw new Error("The model was still working after three minutes.");
}
