export type Aspect = "9:16" | "1:1" | "16:9";
export type EditStyle = "cinematic" | "punch" | "fast";

export type FormatId =
  | "result-first"
  | "wrong-right"
  | "say-this"
  | "before-after"
  | "trio"
  | "save-chart"
  | "go-go"
  | "cringe"
  | "carousel"
  | "one-question";

export type Shot = {
  kicker: string;
  line: string;
  detail: string;
};

export type ReelPlan = {
  title: string;
  subject: string;
  niche: string;
  formatId: FormatId;
  formatName: string;
  hook: string;
  caption: string;
  hashtags: string[];
  audio: string;
  shots: Shot[];
  duration: number;
  aspect: Aspect;
  edit: EditStyle;
  bpm: number;
};

export type PlanInput = {
  prompt: string;
  formatId: string;
  duration: number;
  aspect: string;
  edit: string;
};

export type FormatSpec = {
  id: FormatId;
  name: string;
  summary: string;
  example: string;
  audio: string;
};

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanError";
  }
}

export const FORMATS: FormatSpec[] = [
  {
    id: "result-first",
    name: "Result first",
    summary: "Open on the finished thing, then show how you got there.",
    example: "weeknight chili that looks like it simmered all day",
    audio: "Hold a steady beat. Cut on the downbeat when the bowl comes back.",
  },
  {
    id: "wrong-right",
    name: "Wrong, then right",
    summary: "Show the messy version, then the clean version, with almost no talk.",
    example: "how to pack a carry-on so the laptop is not on the bottom",
    audio: "A short stop before the fix. Let the second half feel lighter.",
  },
  {
    id: "say-this",
    name: "Say this instead",
    summary: "Name an awkward moment and put the exact sentence on screen.",
    example: "the text I send when a client goes quiet for a week",
    audio: "Keep the bed quiet so the sentence is the whole joke.",
  },
  {
    id: "before-after",
    name: "Before / after flash",
    summary: "Flash the change in the first second, then explain the one move.",
    example: "a ten-minute apartment reset before people come over",
    audio: "Two hits up front, then space while the after shot holds.",
  },
  {
    id: "trio",
    name: "Three versions",
    summary: "Stack a beginner, a polished take, and one ridiculous third option.",
    example: "three ways to answer when someone asks what you do",
    audio: "One hit per row. The third row gets the extra kick.",
  },
  {
    id: "save-chart",
    name: "Chart worth saving",
    summary: "Put the whole reference on one screen so people pause and save it.",
    example: "a week of desk lunches that are not a sad salad",
    audio: "Almost no drums. A soft pulse so the words stay readable.",
  },
  {
    id: "go-go",
    name: "Go go go",
    summary: "Impatience comedy. The cut keeps moving while the words stay polite.",
    example: "waiting for the group chat to pick a restaurant",
    audio: "Fast hats. The words land like you are smiling through it.",
  },
  {
    id: "cringe",
    name: "Cringe confession",
    summary: "Then versus now. Admit the old habit, then show the current one.",
    example: "the notes app I used instead of actually starting the project",
    audio: "Half-time. Leave a gap between the old habit and the new one.",
  },
  {
    id: "carousel",
    name: "One idea a frame",
    summary: "Five beats, one idea each, like a photo carousel with motion.",
    example: "what I film in a rental before I trust the listing",
    audio: "Even pace, one hit per slide, no fill.",
  },
  {
    id: "one-question",
    name: "Answer one question",
    summary: "Take a single viewer question and answer it without a fake number.",
    example: "what it actually costs to shoot a weekend away on a phone",
    audio: "Sparse. The answer line should be the loudest moment.",
  },
];

const NICHES: { id: string; words: string[] }[] = [
  { id: "food", words: ["dinner", "recipe", "cook", "chili", "lunch", "breakfast", "kitchen", "eat", "bowl"] },
  { id: "beauty", words: ["makeup", "skin", "hair", "curl", "lipstick", "routine"] },
  { id: "fitness", words: ["workout", "gym", "run", "lift", "stretch", "walk"] },
  { id: "money", words: ["money", "rent", "salary", "budget", "invoice", "client", "cost", "costs"] },
  { id: "home", words: ["apartment", "room", "clean", "guest", "furniture", "rental", "desk"] },
  { id: "tech", words: ["app", "phone", "laptop", "camera", "edit", "code"] },
];

export function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const word = cut.replace(/\s+\S*$/, "");
  return `${word.length > 12 ? word : cut.trim()}…`;
}

export function bpmFor(edit: EditStyle): number {
  if (edit === "fast") return 132;
  if (edit === "cinematic") return 96;
  return 112;
}

export function frameSize(aspect: Aspect): { width: number; height: number } {
  if (aspect === "16:9") return { width: 1280, height: 720 };
  if (aspect === "1:1") return { width: 960, height: 960 };
  return { width: 720, height: 1280 };
}

export function shotTiming(plan: ReelPlan, time: number): { index: number; local: number; dur: number; shot: Shot } {
  const count = Math.max(1, plan.shots.length);
  const dur = plan.duration / count;
  const clamped = Math.min(Math.max(time, 0), Math.max(plan.duration - 0.001, 0));
  const index = Math.min(count - 1, Math.floor(clamped / dur));
  return { index, local: clamped - index * dur, dur, shot: plan.shots[index] };
}

function assertAllowed(prompt: string): void {
  const text = prompt.toLowerCase();
  const minor = /\b(child|children|minor|minors|underage|preteen|pre-teen|kid|kids)\b/;
  const sexual = /\b(sex|sexual|nude|naked|porn|nsfw)\b/;
  if (minor.test(text) && sexual.test(text)) {
    throw new PlanError("That prompt can't be made into a video here.");
  }
}

function asAspect(value: string): Aspect {
  if (value === "1:1" || value === "16:9" || value === "9:16") return value;
  return "9:16";
}

function asEdit(value: string): EditStyle {
  if (value === "cinematic" || value === "fast" || value === "punch") return value;
  return "punch";
}

function asFormat(value: string): FormatSpec {
  return FORMATS.find((format) => format.id === value) ?? FORMATS[0];
}

function asDuration(value: number): number {
  if (value <= 7) return 6;
  if (value >= 10) return 10;
  return 8;
}

function nicheFor(subject: string): string {
  const text = subject.toLowerCase();
  let best = "general";
  let score = 0;
  for (const niche of NICHES) {
    const hits = niche.words.filter((word) => text.includes(word)).length;
    if (hits > score) {
      score = hits;
      best = niche.id;
    }
  }
  return best;
}

function tagify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

const TAG_SKIP = new Set([
  "that", "this", "with", "from", "your", "looks", "like", "when", "what", "just", "into", "over",
  "they", "them", "then", "than", "have", "been", "were", "will", "before", "after", "about",
  "day", "all", "and", "the", "for", "you", "not", "are", "but", "how", "who", "its", "it's",
]);

function hashtagsFor(subject: string, niche: string): string[] {
  const words = subject
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(tagify)
    .filter((word) => word.length >= 4 && word.length <= 18 && !TAG_SKIP.has(word));
  const unique = [...new Set([niche === "general" ? "" : niche, ...words, "reelroom"])].filter(Boolean);
  return unique.slice(0, 5);
}

function shotsFor(format: FormatId, subject: string, short: string): Shot[] {
  const line = short;
  switch (format) {
    case "wrong-right":
      return [
        { kicker: "The usual way", line: clip(`Stop: ${line}`, 46), detail: "Film the version that wastes the first second." },
        { kicker: "Why it dies", line: "Too much, too early", detail: clip(`You explain ${subject} before anyone can see it.`, 100) },
        { kicker: "The fix", line: clip(`Do: ${line}`, 46), detail: "One action. Closer than feels comfortable." },
        { kicker: "Post it", line: "Wrong, then right", detail: "No intro. The fix should feel like a relief." },
      ];
    case "say-this":
      return [
        { kicker: "The moment", line, detail: "Name the situation in the first line. Don't warm up." },
        { kicker: "Don't send", line: "Sorry, just circling back", detail: "The apology makes the ask smaller than it is." },
        { kicker: "Send this", line: clip(line, 42), detail: clip(`Say the specific thing about ${subject}. Then stop.`, 100) },
        { kicker: "Then leave it", line: "Send it once", detail: "The second text is the one that sounds unsure." },
      ];
    case "before-after":
      return [
        { kicker: "After", line, detail: "This frame is the whole reason to watch." },
        { kicker: "Before", line: "Thirty seconds earlier", detail: clip(`Show the before of ${subject} without narrating it.`, 100) },
        { kicker: "The only move", line: "Change one thing", detail: "If you list five steps, nobody will copy it." },
        { kicker: "Flash it again", line: "Hold the after", detail: "End on the same frame you opened with." },
      ];
    case "trio":
      return [
        { kicker: "Version A", line: "The careful one", detail: clip(`${line}, said the safe way.`, 90) },
        { kicker: "Version B", line: "The polished one", detail: "Same idea, fewer words, better light." },
        { kicker: "Version C", line: "The one that wins", detail: clip(`Make ${subject} slightly too honest.`, 90) },
        { kicker: "Pick C", line: "Post the third", detail: "The middle option is what everyone already filmed." },
      ];
    case "save-chart":
      return [
        { kicker: "Save this", line, detail: "One screen. No talking head required." },
        { kicker: "Row one", line: "The first pass", detail: clip(`What ${subject} looks like when you rush it.`, 90) },
        { kicker: "Row two", line: "The version to copy", detail: "Write the step a stranger could do today." },
        { kicker: "Row three", line: "Leave this out", detail: "Don't invent a number. If you don't know it, say so." },
        { kicker: "Pause here", line: "They save the frame", detail: "Hold still for a full beat at the end." },
      ];
    case "go-go":
      return [
        { kicker: "Still waiting", line: "Go go go", detail: clip(subject, 90) },
        { kicker: "Still polite", line: clip(line, 40), detail: "Smile. The cut is the part that is impatient." },
        { kicker: "Still here", line: "Any minute now", detail: "Repeat the same frame. Change only the words." },
        { kicker: "Still going", line: "We can leave", detail: "The punchline is how long you stayed." },
        { kicker: "Cut", line: "Go.", detail: "End before you explain the joke." },
      ];
    case "cringe":
      return [
        { kicker: "Then", line: "I used to do this", detail: clip(subject, 100) },
        { kicker: "Be honest", line: clip(line, 42), detail: "The embarrassing version has to be specific." },
        { kicker: "Now", line: "I do this instead", detail: "Show the current habit, not a speech about growth." },
        { kicker: "Keep it", line: "Both can stay", detail: "The joke works if you still understand the old you." },
      ];
    case "carousel":
      return [
        { kicker: "01", line, detail: "First frame has to earn the swipe." },
        { kicker: "02", line: "Look closer", detail: clip(`The detail people miss in ${subject}.`, 90) },
        { kicker: "03", line: "The check", detail: "One test. Pass or fail. Don't add a third state." },
        { kicker: "04", line: "The skip", detail: "Say what you no longer bother filming." },
        { kicker: "05", line: "Do this today", detail: "The last frame is the only instruction." },
      ];
    case "one-question":
      return [
        { kicker: "The question", line, detail: "Use their words, not a headline you invented." },
        { kicker: "The answer", line: "Here is the short version", detail: clip(`For ${subject}, say the constraint first.`, 100) },
        { kicker: "The part to skip", line: "Don't fake a number", detail: "If you don't know the price, film the tradeoff instead." },
        { kicker: "The line they quote", line: clip(line, 42), detail: "Put that sentence in the caption too." },
      ];
    case "result-first":
    default:
      return [
        { kicker: "Watch this first", line, detail: "The result, before the explanation." },
        { kicker: "Then rewind", line: "Start at the end", detail: clip(`Film ${subject} before you talk.`, 100) },
        { kicker: "One step", line: "Show one move", detail: "Cut any sentence that doesn't change the result." },
        { kicker: "End where you began", line: "Same frame again", detail: "Last shot matches the first. Caption does the rest." },
      ];
  }
}

export function planReel(input: PlanInput): ReelPlan {
  const raw = typeof input.prompt === "string" ? input.prompt : "";
  assertAllowed(raw);
  const subject = clip(raw, 180);
  if (subject.length < 3) throw new PlanError("Write a prompt first.");
  const format = asFormat(input.formatId);
  const edit = asEdit(input.edit);
  const duration = asDuration(Number(input.duration));
  const aspect = asAspect(input.aspect);
  const niche = nicheFor(subject);
  const short = clip(subject, 42);
  const shots = shotsFor(format.id, subject, short);
  const hook = shots[0]?.line ?? short;
  const hashtags = hashtagsFor(subject, niche);
  return {
    title: short,
    subject,
    niche,
    formatId: format.id,
    formatName: format.name,
    hook,
    caption: clip(`${hook}. ${shots[1]?.detail ?? format.summary}`, 180),
    hashtags,
    audio: format.audio,
    shots,
    duration,
    aspect,
    edit,
    bpm: bpmFor(edit),
  };
}

export function sanitizeTags(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const tags = value
    .map((tag) => tagify(String(tag)))
    .filter((tag) => tag.length >= 3);
  const unique = [...new Set(tags)];
  return unique.length ? unique.slice(0, 5) : fallback;
}

export function adoptPlan(local: ReelPlan, incoming: unknown): ReelPlan {
  if (!incoming || typeof incoming !== "object") return local;
  const record = incoming as Record<string, unknown>;
  const rawShots = Array.isArray(record.shots) ? record.shots : [];
  if (rawShots.length < 3) return local;
  const shots = rawShots.slice(0, 6).map((shot, index) => {
    const row = shot && typeof shot === "object" ? (shot as Record<string, unknown>) : {};
    const fallback = local.shots[Math.min(index, local.shots.length - 1)];
    return {
      kicker: clip(String(row.kicker || fallback.kicker), 24),
      line: clip(String(row.line || fallback.line), 48),
      detail: clip(String(row.detail || fallback.detail), 110),
    };
  });
  return {
    ...local,
    title: clip(String(record.title || local.title), 60),
    hook: clip(String(record.hook || shots[0].line), 80),
    caption: clip(String(record.caption || local.caption), 180),
    hashtags: sanitizeTags(record.hashtags, local.hashtags),
    audio: clip(String(record.audio || local.audio), 160),
    shots,
  };
}
