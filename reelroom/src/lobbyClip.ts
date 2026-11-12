export const LOBBY_CLIP_URL = "/lobby-motion.mp4";
const ORANGE = "#ff6200";

export type LobbyPhotos = {
  left: HTMLImageElement | null;
  right: HTMLImageElement | null;
};

type Point = { x: number; y: number };

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

let clipVideo: HTMLVideoElement | null = null;
let scratch: HTMLCanvasElement | null = null;
let smoothLeft: Point = { x: 520, y: 180 };
let smoothRight: Point = { x: 900, y: 170 };

function clipElement(): HTMLVideoElement {
  if (!clipVideo) {
    const video = document.createElement("video");
    video.src = LOBBY_CLIP_URL;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    clipVideo = video;
  }
  return clipVideo;
}

export function loadLobbyClip(): Promise<HTMLVideoElement> {
  const video = clipElement();
  if (video.readyState >= 2) return Promise.resolve(video);
  return new Promise((resolve, reject) => {
    const ready = () => {
      if (video.readyState < 2) return;
      cleanup();
      resolve(video);
    };
    const fail = () => {
      cleanup();
      reject(new Error("The hotel lobby motion clip didn't load."));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("seeked", ready);
      video.removeEventListener("error", fail);
    };
    video.addEventListener("loadeddata", ready);
    video.addEventListener("canplay", ready);
    video.addEventListener("seeked", ready);
    video.addEventListener("error", fail);
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.08) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, 700);
    video.addEventListener("seeked", finish);
    video.currentTime = time;
  });
}

function scratchContext(width: number, height: number): CanvasRenderingContext2D {
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== width) scratch.width = width;
  if (scratch.height !== height) scratch.height = height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Couldn't read the motion clip.");
  return ctx;
}

function isInk(data: Uint8ClampedArray, index: number): boolean {
  return data[index] < 145 && data[index + 1] < 145 && data[index + 2] < 145;
}

function findHead(data: Uint8ClampedArray, width: number, x0: number, x1: number, fallback: Point): Point {
  let top = 0;
  for (let y = 50; y < 420; y += 1) {
    let count = 0;
    for (let x = x0; x < x1; x += 2) {
      if (isInk(data, (y * width + x) * 4)) count += 1;
    }
    if (count >= 3) {
      top = y;
      break;
    }
  }
  if (!top) return fallback;
  const xs: number[] = [];
  const y1 = Math.min(top + 150, data.length / 4 / width);
  for (let y = top; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      if (isInk(data, (y * width + x) * 4)) xs.push(x);
    }
  }
  if (xs.length < 8) return fallback;
  xs.sort((a, b) => a - b);
  return { x: xs[xs.length >> 1], y: top + 78 };
}

function follow(previous: Point, next: Point): Point {
  return {
    x: previous.x + (next.x - previous.x) * 0.5,
    y: previous.y + (next.y - previous.y) * 0.5,
  };
}

function drawPhoto(ctx: CanvasRenderingContext2D, photo: HTMLImageElement | null, center: Point, radius: number, label: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    const scale = Math.max((radius * 2) / photo.naturalWidth, (radius * 2) / photo.naturalHeight);
    const dw = photo.naturalWidth * scale;
    const dh = photo.naturalHeight * scale;
    ctx.drawImage(photo, center.x - dw / 2, center.y - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#ff8a3d";
    ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#1b1814";
    ctx.font = `700 ${Math.round(radius * 0.28)}px Syne, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, center.x, center.y);
  }
  ctx.restore();
}

export function paintLobby(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, photos: LobbyPhotos): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const source = scratchContext(width, height);
  source.drawImage(video, 0, 0, width, height);
  const frame = source.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const scale = width / 1280;
  smoothLeft = follow(smoothLeft, findHead(pixels, width, Math.round(width * 0.28), Math.round(width * 0.53), smoothLeft));
  smoothRight = follow(smoothRight, findHead(pixels, width, Math.round(width * 0.62), Math.round(width * 0.92), smoothRight));
  const leftRadius = 108 * scale;
  const rightRadius = 112 * scale;

  ctx.fillStyle = ORANGE;
  ctx.fillRect(0, 0, width, height);
  drawPhoto(ctx, photos.left, smoothLeft, leftRadius, "Left");
  drawPhoto(ctx, photos.right, smoothRight, rightRadius, "Right");

  const painted = ctx.getImageData(0, 0, width, height);
  const output = painted.data;
  const leftLimit = (leftRadius * 0.72) ** 2;
  const rightLimit = (rightRadius * 0.72) ** 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < width * 0.18 && y > height * 0.8) continue;
      const index = (y * width + x) * 4;
      if (!isInk(pixels, index)) continue;
      const leftDistance = (x - smoothLeft.x) ** 2 + (y - smoothLeft.y) ** 2;
      const rightDistance = (x - smoothRight.x) ** 2 + (y - smoothRight.y) ** 2;
      if (leftDistance < leftLimit || rightDistance < rightLimit) continue;
      output[index] = pixels[index];
      output[index + 1] = pixels[index + 1];
      output[index + 2] = pixels[index + 2];
      output[index + 3] = 255;
    }
  }
  ctx.putImageData(painted, 0, 0);
}

export async function paintLobbyPoster(canvas: HTMLCanvasElement, photos: LobbyPhotos, still: () => boolean = () => true): Promise<void> {
  const video = await loadLobbyClip();
  if (!still()) return;
  video.pause();
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = ORANGE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await seekTo(video, 1);
  if (!still()) return;
  smoothLeft = { x: 520, y: 180 };
  smoothRight = { x: 900, y: 170 };
  paintLobby(ctx, video, photos);
}

function mimeType(): string {
  const types = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export async function recordLobby(
  canvas: HTMLCanvasElement,
  photos: LobbyPhotos,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser can't record a video file.");
  const video = await loadLobbyClip();
  const mime = mimeType();
  if (!mime) throw new Error("This browser can't encode the video.");
  video.pause();
  video.muted = false;
  await seekTo(video, 0);
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Couldn't draw the preview.");
  smoothLeft = { x: 520, y: 180 };
  smoothRight = { x: 900, y: 170 };
  paintLobby(ctx, video, photos);

  const stream = canvas.captureStream(25);
  const captured = (video as CapturableVideo).captureStream?.() ?? (video as CapturableVideo).mozCaptureStream?.();
  captured?.getAudioTracks().forEach((track) => stream.addTrack(track));

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("Recording failed."));
  });
  recorder.start(200);
  await video.play();

  await new Promise<void>((resolve) => {
    const step = () => {
      const duration = video.duration || 14.92;
      const time = Math.min(video.currentTime, duration);
      paintLobby(ctx, video, photos);
      onProgress(time / duration);
      if (!video.ended && time < duration - 0.04) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });

  video.pause();
  if (recorder.state !== "inactive") recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  return new Blob(chunks, { type: recorder.mimeType || mime });
}
