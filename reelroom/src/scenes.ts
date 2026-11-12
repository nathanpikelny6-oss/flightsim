import type { ReelPlan } from "../shared/plan.ts";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function ease(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function drawGoal(ctx: CanvasRenderingContext2D, plan: ReelPlan, time: number): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const u = clamp01(time / plan.duration);
  ctx.fillStyle = "#07111c";
  ctx.fillRect(0, 0, w, h);

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.46);
  sky.addColorStop(0, "#10182a");
  sky.addColorStop(1, "#1a2740");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.46);

  for (let light = 0; light < 2; light += 1) {
    const x = light === 0 ? w * 0.16 : w * 0.84;
    const cone = ctx.createLinearGradient(x, h * 0.08, w * 0.5, h * 0.5);
    cone.addColorStop(0, "rgba(255,244,210,0.55)");
    cone.addColorStop(1, "rgba(255,244,210,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 18, h * 0.08);
    ctx.lineTo(x + 18, h * 0.08);
    ctx.lineTo(w * (light === 0 ? 0.42 : 0.58), h * 0.52);
    ctx.closePath();
    ctx.fill();
  }

  const standTop = h * 0.12;
  const standBottom = h * 0.4;
  for (let row = 0; row < 9; row += 1) {
    const y = lerp(standTop, standBottom, row / 8);
    for (let seat = 0; seat < 28; seat += 1) {
      const flash = Math.sin(time * 6 + row * 0.7 + seat) > 0.72;
      ctx.fillStyle = flash ? "#f4f7ff" : row % 2 ? "#243044" : "#1a2436";
      ctx.fillRect((seat / 28) * w + 2, y, w / 34, 7);
    }
  }

  const ground = h * 0.78;
  const grass = ctx.createLinearGradient(0, h * 0.46, 0, h);
  grass.addColorStop(0, "#1f7a3e");
  grass.addColorStop(1, "#14562c");
  ctx.fillStyle = grass;
  ctx.fillRect(0, h * 0.46, w, h - h * 0.46);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  for (let stripe = 0; stripe < 6; stripe += 1) {
    if (stripe % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, h * 0.46 + stripe * ((ground - h * 0.46) / 6), w, (ground - h * 0.46) / 6);
    }
  }
  ctx.beginPath();
  ctx.moveTo(w * 0.08, ground);
  ctx.lineTo(w * 0.92, ground);
  ctx.stroke();

  const goalX = w * 0.8;
  const goalTop = h * 0.5;
  const goalW = w * 0.16;
  const post = Math.max(4, w * 0.008);
  ctx.strokeStyle = "#f7f7f7";
  ctx.lineWidth = post;
  ctx.strokeRect(goalX, goalTop, goalW, ground - goalTop);

  const run = ease(Math.min(1, u / 0.4));
  const playerX = lerp(w * 0.16, w * 0.58, run);
  const struck = u > 0.4;
  const flight = struck ? ease(Math.min(1, (u - 0.4) / 0.38)) : 0;
  const footY = ground - h * 0.11;
  const ballX = struck ? lerp(playerX + w * 0.04, goalX + goalW * 0.72, flight) : playerX + w * 0.045;
  const ballY = struck ? lerp(footY, goalTop + 18, flight) - Math.sin(flight * Math.PI) * h * 0.16 : footY;
  drawPlayer(ctx, playerX, ground, Math.min(w, h) * 0.2, time * 14 * (u < 0.42 ? 1 : 0.2), u > 0.4 && u < 0.48);
  drawBall(ctx, ballX, ballY, Math.max(8, w * 0.018), time);

  if (flight > 0.92) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    const bulge = (flight - 0.92) / 0.08;
    for (let net = 1; net <= 4; net += 1) {
      ctx.beginPath();
      ctx.moveTo(goalX, goalTop + ((ground - goalTop) * net) / 5);
      ctx.quadraticCurveTo(goalX + goalW * 0.55 + bulge * 16, goalTop + ((ground - goalTop) * net) / 5, goalX + goalW, goalTop + ((ground - goalTop) * net) / 5);
      ctx.stroke();
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, ground: number, s: number, phase: number, kicking: boolean): void {
  const stride = Math.sin(phase) * s * 0.22;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, ground - 4, s * 0.28, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f4f1ea";
  ctx.fillStyle = "#f4f1ea";
  ctx.lineWidth = Math.max(3, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, ground - s * 0.42);
  ctx.lineTo(x - s * 0.08 + stride, ground);
  ctx.moveTo(x, ground - s * 0.42);
  ctx.lineTo(x + s * 0.16 - stride, kicking ? ground - s * 0.28 : ground);
  ctx.stroke();
  ctx.fillStyle = "#f7f4ee";
  ctx.fillRect(x - s * 0.11, ground - s * 0.78, s * 0.22, s * 0.36);
  ctx.fillStyle = "#d23b32";
  ctx.fillRect(x - s * 0.2, ground - s * 0.76, s * 0.1, s * 0.16);
  ctx.fillRect(x + s * 0.1, ground - s * 0.76, s * 0.1, s * 0.16);
  ctx.fillStyle = "#1b1814";
  ctx.font = `700 ${Math.max(10, s * 0.16)}px Syne, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("10", x, ground - s * 0.54);
  ctx.fillStyle = "#e6c2a4";
  ctx.beginPath();
  ctx.arc(x, ground - s * 0.9, s * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1814";
  ctx.beginPath();
  ctx.arc(x, ground - s * 0.96, s * 0.11, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 8);
  ctx.fillStyle = "#f7f7f7";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1814";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

type LobbyPose = {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  look: number;
  nod: number;
  face: number;
};

const LOBBY_CLIP = 14.92;

function lobbyPose(time: number, keys: { t: number; p: LobbyPose }[]): LobbyPose {
  if (time <= keys[0].t) return keys[0].p;
  for (let index = 1; index < keys.length; index += 1) {
    const next = keys[index];
    if (time > next.t) continue;
    const prev = keys[index - 1];
    const span = next.t - prev.t;
    const t = span <= 0 ? 1 : (time - prev.t) / span;
    const mix = (key: keyof LobbyPose) => lerp(prev.p[key], next.p[key], t);
    return { lx: mix("lx"), ly: mix("ly"), rx: mix("rx"), ry: mix("ry"), look: mix("look"), nod: mix("nod"), face: mix("face") };
  }
  return keys[keys.length - 1].p;
}

function lobbyKeys(rows: [number, number, number, number, number, number, number, number][]): { t: number; p: LobbyPose }[] {
  return rows.map(([t, lx, ly, rx, ry, look, nod, face]) => ({ t, p: { lx, ly, rx, ry, look, nod, face } }));
}

export function drawLobby(ctx: CanvasRenderingContext2D, plan: ReelPlan, time: number): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const clipTime = clamp01(time / plan.duration) * LOBBY_CLIP;
  ctx.fillStyle = "#f6f3ee";
  ctx.fillRect(0, 0, w, h);

  const wide = w > h;
  const s = (wide ? h : w) * (wide ? 0.78 : 0.86);
  const waist = h * (wide ? 0.92 : 0.76);
  const shoulderY = waist - s * 0.5;
  const headY = shoulderY - s * 0.28;
  const micX = w * 0.5;
  const micBottom = headY;
  const micTop = micBottom - s * 0.22;
  ctx.strokeStyle = "#1b1814";
  ctx.lineWidth = Math.max(2, s * 0.012);
  ctx.beginPath();
  ctx.moveTo(micX, 0);
  ctx.lineTo(micX, micTop);
  ctx.stroke();
  ctx.fillStyle = "#2c2c2c";
  ctx.fillRect(micX - s * 0.025, micTop, s * 0.05, micBottom - micTop);
  ctx.fillStyle = "#d8d2c8";
  ctx.fillRect(micX - s * 0.04, micTop, s * 0.08, s * 0.03);
  ctx.fillRect(micX - s * 0.04, micBottom - s * 0.03, s * 0.08, s * 0.035);

  const left = lobbyPose(
    clipTime,
    lobbyKeys([
      [0, -0.36, 0.48, 0.36, 0.48, 0, 0.2, 1],
      [3.5, -0.36, 0.48, 0.36, 0.48, 0, 0.2, 1],
      [4.4, -0.34, 0.46, 0.46, 0.24, 1, 0, 1],
      [6.2, -0.36, 0.48, 0.36, 0.46, 1, 0, 1],
      [7.5, -0.16, 0.16, 0.36, 0.46, 1, 0, 1],
      [11.6, -0.16, 0.16, 0.36, 0.46, 1, 0, 1],
      [12.4, -0.36, 0.46, 0.04, -0.34, 1, 0, 1],
      [13.4, -0.36, 0.46, 0.04, -0.34, 1, 0, 1],
      [14.1, -0.34, 0.12, 0.36, 0.12, 0, 0.8, 1],
      [LOBBY_CLIP, -0.34, 0.12, 0.36, 0.12, 0, 0.8, 1],
    ]),
  );
  const right = lobbyPose(
    clipTime,
    lobbyKeys([
      [0, 0.36, 0.46, -0.48, 0.2, 0.2, 0, 1],
      [1.7, 0.36, 0.46, -0.48, 0.2, 0.2, 0, 1],
      [2.3, -0.14, 0.18, 0.2, 0.16, 0, 0, 1],
      [3.6, -0.14, 0.18, 0.2, 0.16, 0, 0, 1],
      [4.2, 0.36, 0.46, 0.5, 0.22, 1, 0, 1],
      [5.8, 0.36, 0.46, 0.5, 0.22, 1, 0, 1],
      [6.4, 0.36, 0.46, -0.44, 0.14, 1, 0, 1],
      [7.8, 0.36, 0.48, 0.36, 0.48, 0, 0, 1],
      [8.3, 0.02, 0.22, -0.08, 0.14, 0, -1, 1],
      [9.5, 0.02, 0.22, -0.08, 0.14, 0, -1, 1],
      [10.6, 0.36, 0.5, 0.52, 0.28, 0, 0, -1],
      [11.3, 0.36, 0.5, 0.52, 0.28, 0, 0, -1],
      [11.9, 0.36, 0.46, 0.36, 0.46, 0.5, 0, 1],
      [12.6, 0.36, 0.46, 0.05, -0.34, 1, 0, 1],
      [13.35, 0.36, 0.46, 0.05, -0.34, 1, 0, 1],
      [13.9, 0.36, 0.46, 0.32, 0.16, 0, 0.2, 1],
      [14.45, -0.06, -0.5, 0.36, 0.46, 1, 0.7, 1],
      [LOBBY_CLIP, -0.06, -0.5, 0.36, 0.46, 1, 0.7, 1],
    ]),
  );
  drawPerformer(ctx, w * (wide ? 0.32 : 0.28), waist, s, left, "stripes", 1);
  drawPerformer(ctx, w * (wide ? 0.68 : 0.72), waist, s, right, "dots", -1);
}

function drawPerformer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  waist: number,
  s: number,
  pose: LobbyPose,
  shirt: "stripes" | "dots",
  partner: number,
): void {
  const shoulderY = waist - s * 0.5;
  const width = s * (0.1 + 0.16 * Math.abs(pose.face));
  const flip = pose.face < 0 ? -1 : 1;
  const headR = s * 0.15;
  const headY = shoulderY - s * 0.28 + pose.nod * s * 0.07;

  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath();
  ctx.ellipse(cx, waist + 8, width * 1.1, s * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1b1814";
  ctx.beginPath();
  ctx.ellipse(cx, headY - headR * 0.15, headR * 1.05, headR * 1.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e6c2a4";
  ctx.beginPath();
  ctx.ellipse(cx, headY, headR * (0.55 + 0.45 * Math.abs(pose.face)), headR, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pose.face < -0.4) {
    ctx.fillStyle = "#1b1814";
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.95, headR, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (pose.face > 0.4) {
    const eye = partner * pose.look * headR * 0.16;
    ctx.fillStyle = "#1b1814";
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.32 + eye, headY - headR * 0.02, headR * 0.13, headR * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + headR * 0.32 + eye, headY - headR * 0.02, headR * 0.13, headR * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const top = shoulderY - s * 0.02;
  const torsoH = waist - top;
  ctx.fillStyle = shirt === "stripes" ? "#f4efe6" : "#243044";
  ctx.fillRect(cx - width, top, width * 2, torsoH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - width, top, width * 2, torsoH);
  ctx.clip();
  if (shirt === "stripes") {
    ctx.fillStyle = "#1b1814";
    const stripe = Math.max(4, width * 0.22);
    for (let x = cx - width; x < cx + width; x += stripe * 2) ctx.fillRect(x, top, stripe, torsoH);
  } else {
    ctx.fillStyle = "#d5dbe3";
    const step = Math.max(7, width * 0.28);
    for (let y = top + step; y < waist; y += step) {
      for (let x = cx - width + step / 2; x < cx + width; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  const arm = (localX: number, localY: number, shoulderSide: number) => {
    const sx = cx + shoulderSide * width * 0.82;
    const hx = cx + flip * localX * s;
    const hy = shoulderY + localY * s;
    const ex = (sx + hx) / 2;
    const ey = (shoulderY + hy) / 2 + Math.max(0, localY - 0.2) * s * 0.12;
    ctx.strokeStyle = "#e6c2a4";
    ctx.lineWidth = Math.max(4, s * 0.042);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, shoulderY);
    ctx.quadraticCurveTo(ex, ey, hx, hy);
    ctx.stroke();
    ctx.fillStyle = "#e6c2a4";
    ctx.beginPath();
    ctx.arc(hx, hy, Math.max(4, s * 0.035), 0, Math.PI * 2);
    ctx.fill();
    if (localY < -0.2) {
      ctx.strokeStyle = "#1b1814";
      ctx.lineWidth = Math.max(3, s * 0.025);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + flip * s * 0.03, hy - s * 0.1);
      ctx.stroke();
    }
    if (pose.nod < -0.45 && shoulderSide > 0) {
      ctx.fillStyle = "#1b1814";
      ctx.fillRect(hx - s * 0.03, hy - s * 0.02, s * 0.07, s * 0.045);
    }
  };
  arm(pose.lx, pose.ly, -1);
  arm(pose.rx, pose.ry, 1);
}

export function drawSceneCaption(ctx: CanvasRenderingContext2D, text: string): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const size = Math.max(18, Math.min(w, h) * 0.038);
  ctx.font = `700 ${size}px Syne, sans-serif`;
  ctx.textAlign = "left";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.fillStyle = "#f7f4ee";
  const y = h - size * 1.7;
  ctx.strokeText(text, 28, y);
  ctx.fillText(text, 28, y);
}
