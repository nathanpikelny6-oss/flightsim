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

export function drawLobby(ctx: CanvasRenderingContext2D, plan: ReelPlan, time: number): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const u = clamp01(time / plan.duration);
  const cam = u * 7.2;
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(0, 0, w, h);
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, "#3a2a1c");
  wash.addColorStop(0.45, "#24180f");
  wash.addColorStop(1, "#120e0b");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  const horizon = h * 0.4;
  const project = (worldX: number, worldY: number, worldZ: number) => {
    const depth = Math.max(0.35, worldZ - cam);
    const focal = Math.min(w, h) * 0.72;
    return { x: w / 2 + (worldX * focal) / depth, y: horizon + (worldY * focal) / depth, depth };
  };

  for (let band = 0; band < 14; band += 1) {
    const z0 = band * 0.7;
    const z1 = z0 + 0.7;
    if (z1 < cam + 0.35) continue;
    const near = project(-1.6, 1.15, z0);
    const far = project(-1.6, 1.15, z1);
    const nearR = project(1.6, 1.15, z0);
    const farR = project(1.6, 1.15, z1);
    if (near.depth > 12) continue;
    ctx.fillStyle = band % 2 === 0 ? "#cbb79a" : "#a89074";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(near.x, near.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(far.x, far.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const side of [-1, 1]) {
    for (let column = 0; column < 6; column += 1) {
      const z = 2.2 + column * 1.7;
      if (z < cam + 0.9) continue;
      const foot = project(side * 1.15, 1.15, z);
      const cap = project(side * 1.15, -1.25, z);
      if (foot.depth > 10 || foot.depth < 0.9) continue;
      const thickness = Math.min(42, Math.max(6, 70 / foot.depth));
      ctx.fillStyle = "#efe6d6";
      ctx.fillRect(foot.x - thickness / 2, cap.y, thickness, foot.y - cap.y);
      ctx.fillStyle = "#d8c7a4";
      ctx.fillRect(foot.x - thickness * 0.8, cap.y, thickness * 1.6, thickness * 0.35);
    }
  }

  const lamp = project(0, -0.15, 6.4);
  if (lamp.depth < 9) {
    const glow = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 220 / lamp.depth);
    glow.addColorStop(0, "rgba(255,214,140,0.95)");
    glow.addColorStop(1, "rgba(255,214,140,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 220 / lamp.depth, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3e2bc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 28 / lamp.depth, 0, Math.PI * 2);
    ctx.stroke();
  }

  const walkX = lerp(1.05, -0.7, ease(u));
  const walkerZ = 6.2;
  const body = project(walkX, 0.15, walkerZ);
  const feet = project(walkX, 1.15, walkerZ);
  const head = project(walkX, -0.35, walkerZ);
  if (body.depth < 8 && body.depth > 1.1) {
    ctx.strokeStyle = "#1b1814";
    ctx.lineWidth = Math.min(10, Math.max(3, 18 / body.depth));
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(feet.x, feet.y);
    ctx.moveTo(body.x, body.y);
    ctx.lineTo(body.x + Math.sin(time * 3) * 18, feet.y);
    ctx.stroke();
    ctx.fillStyle = "#1b1814";
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(4, 16 / head.depth), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c4a574";
    ctx.beginPath();
    ctx.moveTo(head.x, head.y + 8);
    ctx.lineTo(feet.x + 10, feet.y);
    ctx.stroke();
  }

  const doorL = project(-0.45, -0.9, 11);
  const doorR = project(0.45, -0.9, 11);
  const doorB = project(0.45, 1.15, 11);
  if (doorL.depth < 12) {
    ctx.strokeStyle = "rgba(220,235,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(doorL.x, doorL.y, doorR.x - doorL.x, doorB.y - doorL.y);
  }
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
