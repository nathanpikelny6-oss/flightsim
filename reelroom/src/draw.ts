import { shotTiming, type ReelPlan } from "../shared/plan.ts";

type Palette = {
  bg: string;
  ink: string;
  accent: string;
  mute: string;
  glow: string;
  bad: string;
  good: string;
};

const PALETTES: Palette[] = [
  { bg: "#16130f", ink: "#f6f1e7", accent: "#e7ff4d", mute: "#cbbba6", glow: "#3a3418", bad: "#ff5d3a", good: "#d6ff6a" },
  { bg: "#10141c", ink: "#f4f7fb", accent: "#8be9ff", mute: "#a9b7c9", glow: "#163040", bad: "#ff6b6b", good: "#b6ff9a" },
  { bg: "#1a1216", ink: "#fff4f6", accent: "#ff8aa0", mute: "#e4b8c2", glow: "#3a2030", bad: "#ff4d4d", good: "#e4ff8a" },
  { bg: "#101712", ink: "#f4ffe9", accent: "#c6ff6a", mute: "#b7cbb0", glow: "#1c3020", bad: "#ff8a5b", good: "#eaff9a" },
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function paletteFor(plan: ReelPlan): Palette {
  return PALETTES[hash(plan.subject) % PALETTES.length];
}

function easeOut(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return 1 - (1 - t) * (1 - t);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const push = (line: string) => {
    if (lines.length < maxLines) lines.push(line);
  };
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) push(current);
    current = word;
    while (ctx.measureText(current).width > maxWidth && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && ctx.measureText(`${current.slice(0, cut)}…`).width > maxWidth) cut -= 1;
      push(`${current.slice(0, cut)}…`);
      current = "";
      break;
    }
  }
  if (current) push(current);
  return lines.slice(0, maxLines);
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, palette: Palette, time: number): void {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);
  const drift = Math.sin(time * 0.6) * Math.min(w, h) * 0.04;
  const glow = ctx.createRadialGradient(w * 0.2 + drift, h * 0.18, 20, w * 0.45, h * 0.35, Math.max(w, h) * 0.72);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, palette.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const glow2 = ctx.createRadialGradient(w * 0.85, h * 0.82 + drift, 10, w * 0.7, h * 0.75, Math.max(w, h) * 0.45);
  glow2.addColorStop(0, palette.glow);
  glow2.addColorStop(1, palette.bg);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

function drawChrome(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  time: number,
  s: number,
): void {
  ctx.fillStyle = palette.mute;
  ctx.font = `600 ${Math.round(15 * s)}px Outfit, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText("REELROOM", w - 36 * s, 42 * s);
  ctx.textAlign = "left";
  const progress = time / plan.duration;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(36 * s, h - 58 * s, w - 72 * s, 4 * s);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(36 * s, h - 58 * s, (w - 72 * s) * progress, 4 * s);
  const bars = 12;
  const gap = 7 * s;
  const barW = 5 * s;
  const total = bars * barW + (bars - 1) * gap;
  let x = (w - total) / 2;
  const base = h - 28 * s;
  for (let i = 0; i < bars; i += 1) {
    const phase = (time * (plan.bpm / 60) + i * 0.17) % 1;
    const mag = Math.sin(phase * Math.PI) ** 2;
    const bh = (6 + mag * 22) * s;
    ctx.globalAlpha = 0.35 + mag * 0.65;
    ctx.fillRect(x, base - bh, barW, bh);
    x += barW + gap;
  }
  ctx.globalAlpha = 1;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: string,
  weight: number,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Syne, sans-serif`;
  ctx.textAlign = "left";
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * size * 1.08);
  });
}

function glyph(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  cx: number,
  cy: number,
  r: number,
  time: number,
  pop: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = palette.accent;
  ctx.lineWidth = Math.max(3, r * 0.035);
  const niche = plan.niche;
  if (plan.formatId === "one-question" || niche === "general") {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    const dots = niche === "food" ? 0 : 8;
    for (let i = 0; i < dots; i += 1) {
      const a = time * 0.8 + (i / dots) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (niche === "food") {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.62, r * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, r * 0.15, r * 0.62, Math.PI, 0);
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      const sway = Math.sin(time * 2 + i) * r * 0.06;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2 + i * r * 0.2, r * 0.05);
      ctx.quadraticCurveTo(-r * 0.05 + sway, -r * 0.45, i * r * 0.08, -r * 0.7);
      ctx.stroke();
    }
  } else if (niche === "fitness") {
    for (let i = 0; i < 5; i += 1) {
      const bh = r * (0.35 + ((Math.sin(time * 3 + i) + 1) / 2) * 0.6);
      ctx.fillRect(-r * 0.55 + i * r * 0.26, r * 0.45 - bh, r * 0.16, bh);
    }
  } else if (niche === "money") {
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 0.4);
    ctx.lineTo(-r * 0.3, r * 0.1);
    ctx.lineTo(0, r * 0.22);
    ctx.lineTo(r * 0.35, -r * 0.25 + Math.sin(time) * r * 0.05);
    ctx.lineTo(r * 0.7, -r * 0.45);
    ctx.stroke();
  } else if (niche === "home") {
    round(ctx, -r * 0.55, -r * 0.35, r * 1.1, r * 0.9, r * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.35);
    ctx.lineTo(-r * 0.15, r * 0.55);
    ctx.moveTo(-r * 0.55, r * 0.05);
    ctx.lineTo(r * 0.55, r * 0.05);
    ctx.stroke();
  } else if (niche === "beauty") {
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22 * i, time * 0.2, time * 0.2 + Math.PI * 1.4);
      ctx.stroke();
    }
  } else if (niche === "tech") {
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const on = Math.sin(time * 2 + row + col) > 0;
        ctx.globalAlpha = on ? 1 : 0.35;
        round(ctx, -r * 0.55 + col * r * 0.42, -r * 0.55 + row * r * 0.42, r * 0.28, r * 0.28, r * 0.06);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if (plan.formatId === "one-question") {
    ctx.font = `700 ${Math.round(r * 0.9)}px Syne, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("?", 0, r * 0.28);
  }
  ctx.restore();
}

function entrance(plan: ReelPlan, local: number, dur: number): number {
  const intro = plan.edit === "cinematic" ? 0.45 : 0.16;
  return easeOut(local / Math.min(intro, dur));
}

export function drawFrame(ctx: CanvasRenderingContext2D, plan: ReelPlan, time: number): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = Math.min(w, h) / 720;
  const palette = paletteFor(plan);
  const { shot, index, local, dur } = shotTiming(plan, time);
  const pop = plan.edit === "cinematic" ? 1.06 - entrance(plan, local, dur) * 0.06 : 0.9 + entrance(plan, local, dur) * 0.1;
  drawBackground(ctx, w, h, palette, time);
  if (plan.edit !== "cinematic" && local < 0.045) {
    ctx.fillStyle = palette.ink;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  const vertical = h >= w;
  if (plan.formatId === "wrong-right" || plan.formatId === "before-after") {
    drawSplit(ctx, plan, palette, w, h, s, index, shot.line, shot.detail);
  } else if (plan.formatId === "trio") {
    drawTrio(ctx, plan, palette, w, h, s, index);
  } else if (plan.formatId === "say-this") {
    drawBubbles(ctx, plan, palette, w, h, s, index);
  } else if (plan.formatId === "save-chart") {
    drawChart(ctx, plan, palette, w, h, s, index);
  } else if (plan.formatId === "go-go") {
    drawGo(ctx, plan, palette, w, h, s, shot.line, time);
  } else if (plan.formatId === "cringe") {
    drawCringe(ctx, plan, palette, w, h, s, index);
  } else if (plan.formatId === "carousel") {
    drawSlides(ctx, plan, palette, w, h, s, index);
  } else {
    const cx = vertical ? w / 2 : w * 0.28;
    const cy = vertical ? h * 0.34 : h * 0.46;
    glyph(ctx, plan, palette, cx, cy, 118 * s, time, pop);
    const x = vertical ? 48 * s : w * 0.48;
    const y = vertical ? h * 0.56 : h * 0.32;
    const max = vertical ? w - 96 * s : w * 0.46;
    ctx.fillStyle = palette.accent;
    ctx.font = `600 ${Math.round(16 * s)}px Outfit, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(shot.kicker.toUpperCase(), x, y);
    ctx.font = `700 ${Math.round(48 * s)}px Syne, sans-serif`;
    const lines = wrap(ctx, shot.line, max, 3);
    drawLines(ctx, lines, x, y + 62 * s, Math.round(48 * s), palette.ink, 700);
    ctx.font = `500 ${Math.round(22 * s)}px Outfit, sans-serif`;
    const detail = wrap(ctx, shot.detail, max, 3);
    drawLines(ctx, detail, x, y + 78 * s + lines.length * 52 * s, Math.round(22 * s), palette.mute, 500);
  }

  drawChrome(ctx, plan, palette, w, h, time, s);
}

function drawSplit(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  s: number,
  index: number,
  line: string,
  detail: string,
): void {
  const right = plan.formatId === "before-after" ? index >= 1 && index !== 2 : index >= 2;
  const topH = h * 0.42;
  ctx.fillStyle = right ? "rgba(0,0,0,0.28)" : palette.bad;
  ctx.globalAlpha = right ? 0.35 : 0.9;
  ctx.fillRect(0, 0, w, topH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = right ? palette.good : "rgba(255,255,255,0.08)";
  ctx.globalAlpha = right ? 0.22 : 1;
  ctx.fillRect(0, topH, w, h - topH);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.ink;
  ctx.font = `700 ${Math.round(28 * s)}px Syne, sans-serif`;
  ctx.fillText(plan.formatId === "before-after" ? "BEFORE" : "DON'T", 48 * s, 88 * s);
  ctx.fillText(plan.formatId === "before-after" ? "AFTER" : "DO THIS", 48 * s, topH + 72 * s);
  ctx.font = `700 ${Math.round(42 * s)}px Syne, sans-serif`;
  const lines = wrap(ctx, line, w - 96 * s, 3);
  drawLines(ctx, lines, 48 * s, (right ? topH + 130 * s : 150 * s), Math.round(42 * s), palette.ink, 700);
  ctx.font = `500 ${Math.round(20 * s)}px Outfit, sans-serif`;
  const notes = wrap(ctx, detail, w - 96 * s, 3);
  drawLines(ctx, notes, 48 * s, h * 0.72, Math.round(20 * s), palette.mute, 500);
}

function drawTrio(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  s: number,
  index: number,
): void {
  const rows = plan.shots.slice(0, 3);
  const band = (h - 120 * s) / 3;
  rows.forEach((shot, row) => {
    const y = 24 * s + row * band;
    const active = index === row || (index >= 3 && row === 2);
    ctx.globalAlpha = active ? 1 : 0.45;
    ctx.fillStyle = active ? palette.glow : "rgba(255,255,255,0.03)";
    round(ctx, 28 * s, y, w - 56 * s, band - 16 * s, 18 * s);
    ctx.fill();
    ctx.strokeStyle = active ? palette.accent : "rgba(255,255,255,0.08)";
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.font = `600 ${Math.round(14 * s)}px Outfit, sans-serif`;
    ctx.fillText(shot.kicker.toUpperCase(), 48 * s, y + 36 * s);
    ctx.font = `700 ${Math.round(28 * s)}px Syne, sans-serif`;
    const lines = wrap(ctx, shot.line, w - 120 * s, 2);
    drawLines(ctx, lines, 48 * s, y + 72 * s, Math.round(28 * s), palette.ink, 700);
    ctx.globalAlpha = 1;
  });
}

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  s: number,
  index: number,
): void {
  const bad = plan.shots[1]?.line ?? "Don't send that";
  const good = plan.shots[2]?.line ?? plan.hook;
  const bubbles = [
    { text: bad, x: 36 * s, y: h * 0.16, fill: "#2a2428", label: "Don't send" },
    { text: good, x: 72 * s, y: h * 0.4, fill: palette.glow, label: "Send this" },
  ];
  bubbles.forEach((bubble, bubbleIndex) => {
    const on = index === 0 || index === bubbleIndex + 1 || index > 2;
    ctx.globalAlpha = on ? 1 : 0.35;
    round(ctx, bubble.x, bubble.y, w - 120 * s, 150 * s, 22 * s);
    ctx.fillStyle = bubble.fill;
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.font = `600 ${Math.round(14 * s)}px Outfit, sans-serif`;
    ctx.fillText(bubble.label.toUpperCase(), bubble.x + 22 * s, bubble.y + 36 * s);
    ctx.font = `700 ${Math.round(26 * s)}px Syne, sans-serif`;
    const lines = wrap(ctx, bubble.text, w - 180 * s, 2);
    drawLines(ctx, lines, bubble.x + 22 * s, bubble.y + 78 * s, Math.round(26 * s), palette.ink, 700);
    ctx.globalAlpha = 1;
  });
  ctx.font = `500 ${Math.round(18 * s)}px Outfit, sans-serif`;
  const detail = wrap(ctx, plan.shots[index]?.detail ?? "", w - 96 * s, 3);
  drawLines(ctx, detail, 48 * s, h * 0.72, Math.round(18 * s), palette.mute, 500);
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  s: number,
  index: number,
): void {
  ctx.fillStyle = palette.accent;
  ctx.font = `700 ${Math.round(26 * s)}px Syne, sans-serif`;
  const title = wrap(ctx, plan.title, w - 80 * s, 2);
  drawLines(ctx, title, 40 * s, 78 * s, Math.round(26 * s), palette.ink, 700);
  const cells = plan.shots.slice(0, 4);
  const cols = 2;
  const gap = 12 * s;
  const top = 150 * s;
  const cellW = (w - 80 * s - gap) / cols;
  const cellH = (h * 0.62 - top) / 2;
  cells.forEach((shot, cell) => {
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    const x = 40 * s + col * (cellW + gap);
    const y = top + row * (cellH + gap);
    ctx.globalAlpha = cell === index || index >= cells.length ? 1 : 0.55;
    ctx.fillStyle = palette.glow;
    round(ctx, x, y, cellW, cellH, 16 * s);
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.font = `600 ${Math.round(13 * s)}px Outfit, sans-serif`;
    ctx.fillText(String(cell + 1).padStart(2, "0"), x + 16 * s, y + 28 * s);
    ctx.font = `700 ${Math.round(20 * s)}px Syne, sans-serif`;
    const lines = wrap(ctx, shot.line, cellW - 32 * s, 3);
    drawLines(ctx, lines, x + 16 * s, y + 58 * s, Math.round(20 * s), palette.ink, 700);
    ctx.globalAlpha = 1;
  });
}

function drawGo(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  s: number,
  line: string,
  time: number,
): void {
  const beat = (time * plan.bpm) / 60;
  const scale = 1 + (beat % 1 < 0.12 ? 0.04 : 0);
  ctx.save();
  ctx.translate(w / 2, h * 0.38);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.fillStyle = palette.accent;
  ctx.font = `800 ${Math.round(92 * s)}px Syne, sans-serif`;
  ctx.fillText("GO", 0, 0);
  ctx.fillStyle = palette.ink;
  ctx.font = `700 ${Math.round(36 * s)}px Syne, sans-serif`;
  const lines = wrap(ctx, line === "Go go go" ? plan.subject : line, w * 0.8, 3);
  lines.forEach((text, i) => ctx.fillText(text, 0, 70 * s + i * 42 * s));
  ctx.restore();
}

function drawCringe(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  s: number,
  index: number,
): void {
  const cards = [
    { label: "Then", text: plan.shots[0]?.detail ?? plan.subject, y: h * 0.14 },
    { label: "Now", text: plan.shots[2]?.line ?? "I do this instead", y: h * 0.48 },
  ];
  cards.forEach((card, cardIndex) => {
    const on = index <= 1 ? cardIndex === 0 : true;
    ctx.globalAlpha = on ? 1 : 0.4;
    round(ctx, 36 * s, card.y, w - 72 * s, h * 0.26, 20 * s);
    ctx.fillStyle = cardIndex === 0 ? "#241c1c" : palette.glow;
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.font = `600 ${Math.round(15 * s)}px Outfit, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(card.label.toUpperCase(), 60 * s, card.y + 42 * s);
    ctx.font = `700 ${Math.round(28 * s)}px Syne, sans-serif`;
    const lines = wrap(ctx, card.text, w - 140 * s, 3);
    drawLines(ctx, lines, 60 * s, card.y + 84 * s, Math.round(28 * s), palette.ink, 700);
    ctx.globalAlpha = 1;
  });
}

function drawSlides(
  ctx: CanvasRenderingContext2D,
  plan: ReelPlan,
  palette: Palette,
  w: number,
  h: number,
  s: number,
  index: number,
): void {
  const shot = plan.shots[index] ?? plan.shots[0];
  ctx.fillStyle = palette.accent;
  ctx.font = `700 ${Math.round(88 * s)}px Syne, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(String(index + 1).padStart(2, "0"), 48 * s, h * 0.28);
  ctx.font = `700 ${Math.round(40 * s)}px Syne, sans-serif`;
  const lines = wrap(ctx, shot.line, w - 96 * s, 3);
  drawLines(ctx, lines, 48 * s, h * 0.42, Math.round(40 * s), palette.ink, 700);
  ctx.font = `500 ${Math.round(20 * s)}px Outfit, sans-serif`;
  const detail = wrap(ctx, shot.detail, w - 96 * s, 3);
  drawLines(ctx, detail, 48 * s, h * 0.42 + lines.length * 48 * s + 16 * s, Math.round(20 * s), palette.mute, 500);
  plan.shots.forEach((_, dot) => {
    ctx.fillStyle = dot === index ? palette.accent : "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(48 * s + dot * 22 * s, h * 0.78, dot === index ? 5 * s : 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

let fontsReady: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  if (!fontsReady) {
    const loads = Promise.all([
      document.fonts.load("700 64px Syne"),
      document.fonts.load("500 28px Outfit"),
    ]).then(() => undefined);
    fontsReady = Promise.race([loads, new Promise<void>((resolve) => setTimeout(resolve, 1800))]);
  }
  return fontsReady;
}
