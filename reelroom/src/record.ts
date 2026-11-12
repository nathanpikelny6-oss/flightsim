import { loadFonts, drawFrame } from "./draw.ts";
import type { ReelPlan } from "../shared/plan.ts";

function mimeType(): string {
  const types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function scheduleBeat(ctx: AudioContext, destination: AudioNode, plan: ReelPlan): void {
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const step = 60 / plan.bpm;
  const start = ctx.currentTime + 0.05;
  for (let t = 0; t < plan.duration - 0.05; t += step) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, start + t);
    osc.frequency.exponentialRampToValueAtTime(48, start + t + 0.14);
    gain.gain.setValueAtTime(0.0001, start + t);
    gain.gain.exponentialRampToValueAtTime(0.7, start + t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t + 0.18);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start + t);
    osc.stop(start + t + 0.2);
    if (Math.round(t / step) % 2 === 1) {
      const hat = ctx.createBufferSource();
      const hatGain = ctx.createGain();
      hat.buffer = noise;
      hatGain.gain.value = plan.edit === "cinematic" ? 0.05 : 0.12;
      hat.connect(hatGain);
      hatGain.connect(destination);
      hat.start(start + t);
    }
  }
}

export function fileExtension(type: string): string {
  return type.includes("mp4") ? "mp4" : "webm";
}

export async function recordReel(
  canvas: HTMLCanvasElement,
  plan: ReelPlan,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser can't record a video file.");
  }
  await loadFonts();
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Couldn't draw the preview.");
  const mime = mimeType();
  if (!mime) throw new Error("This browser can't encode the video.");

  drawFrame(ctx, plan, 0);
  const stream = canvas.captureStream(30);
  const audio = new AudioContext();
  await audio.resume();
  const mix = audio.createGain();
  mix.gain.value = 0.9;
  const dest = audio.createMediaStreamDestination();
  mix.connect(dest);
  mix.connect(audio.destination);
  scheduleBeat(audio, mix, plan);
  const [track] = dest.stream.getAudioTracks();
  if (track) stream.addTrack(track);

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("Recording failed."));
  });
  recorder.start(200);

  const started = performance.now();
  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      const elapsed = (now - started) / 1000;
      const time = Math.min(elapsed, plan.duration);
      drawFrame(ctx, plan, time);
      onProgress(time / plan.duration);
      if (elapsed < plan.duration) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });

  if (recorder.state !== "inactive") recorder.stop();
  await stopped;
  stream.getTracks().forEach((item) => item.stop());
  await audio.close();
  return new Blob(chunks, { type: recorder.mimeType || mime });
}
