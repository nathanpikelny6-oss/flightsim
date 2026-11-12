import { providerModelIds, type Provider } from "./models.ts";

const HOST_SUFFIXES = [
  "generativelanguage.googleapis.com",
  "googleapis.com",
  "googleusercontent.com",
  "aliyuncs.com",
  "aliyun.com",
  "volces.com",
  "byteplus.com",
  "bytepluses.com",
  "ibytedtos.com",
  "byteimg.com",
  "ibyteimg.com",
];

export function cleanKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  if (key.length < 10 || key.length > 400) return null;
  if (/\s/.test(key)) return null;
  return key;
}

export function cleanRegion(value: unknown): "intl" | "cn" {
  return value === "cn" ? "cn" : "intl";
}

export function safeText(value: string, key: string): string {
  const clipped = value.replace(/\s+/g, " ").trim().slice(0, 280);
  if (!key) return clipped;
  return clipped.split(key).join("[key]");
}

export function veoOperation(taskId: string): string | null {
  const parts = taskId.split("/");
  if (parts.length !== 4) return null;
  if (parts[0] !== "models" || parts[2] !== "operations") return null;
  if (!providerModelIds("gemini").includes(parts[1])) return null;
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(parts[3])) return null;
  return parts.join("/");
}

export function plainTaskId(taskId: string): string | null {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(taskId)) return null;
  return taskId;
}

export function allowedVideoUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const ok = HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  if (!ok) return null;
  return url;
}

export function endpoint(provider: Provider, region: "intl" | "cn"): string {
  if (provider === "dashscope") {
    return region === "cn" ? "https://dashscope.aliyuncs.com" : "https://dashscope-intl.aliyuncs.com";
  }
  if (provider === "ark") {
    return region === "cn" ? "https://ark.cn-beijing.volces.com" : "https://ark.ap-southeast.byteplus.com";
  }
  return "https://generativelanguage.googleapis.com";
}
