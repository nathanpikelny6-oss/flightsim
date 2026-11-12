import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATS, frameSize, planReel, PlanError, type Aspect, type ReelPlan } from "../shared/plan.ts";
import { MODELS, modelById, type Provider } from "../shared/models.ts";
import { drawFrame, loadFonts } from "./draw.ts";
import { fileExtension, recordReel } from "./record.ts";
import { loadPlan, runProvider } from "./clientApi.ts";
import { ModelBoard, TrendBoard } from "./panels.tsx";

type View = "studio" | "trends" | "models";
type Keys = { gemini: string; dashscope: string; ark: string; region: "intl" | "cn" };

const EMPTY_KEYS: Keys = { gemini: "", dashscope: "", ark: "", region: "intl" };

function loadKeys(): Keys {
  try {
    const raw = localStorage.getItem("reelroom.keys");
    if (!raw) return EMPTY_KEYS;
    const parsed = JSON.parse(raw) as Partial<Keys>;
    return {
      gemini: typeof parsed.gemini === "string" ? parsed.gemini : "",
      dashscope: typeof parsed.dashscope === "string" ? parsed.dashscope : "",
      ark: typeof parsed.ark === "string" ? parsed.ark : "",
      region: parsed.region === "cn" ? "cn" : "intl",
    };
  } catch {
    return EMPTY_KEYS;
  }
}

function keyName(provider: Provider): keyof Keys {
  if (provider === "dashscope") return "dashscope";
  if (provider === "ark") return "ark";
  return "gemini";
}

function keyLabel(provider: Provider): string {
  if (provider === "dashscope") return "DashScope API key";
  if (provider === "ark") return "BytePlus ModelArk key";
  return "Gemini API key";
}

export function App() {
  const [view, setView] = useState<View>("studio");
  const [prompt, setPrompt] = useState("weeknight chili that looks like it simmered all day");
  const [formatId, setFormatId] = useState("result-first");
  const [modelId, setModelId] = useState("reelroom");
  const [duration, setDuration] = useState(6);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [keys, setKeys] = useState<Keys>(EMPTY_KEYS);
  const [keysReady, setKeysReady] = useState(false);
  const [draft, setDraft] = useState<ReelPlan | null>(null);
  const [result, setResult] = useState<ReelPlan | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState("video/webm");
  const [engine, setEngine] = useState("Reelroom");
  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("Ready when you are");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const urlRef = useRef<string | null>(null);

  const model = modelById(modelId) ?? MODELS[0];

  useEffect(() => {
    setKeys(loadKeys());
    setKeysReady(true);
  }, []);

  useEffect(() => {
    if (!keysReady) return;
    localStorage.setItem("reelroom.keys", JSON.stringify(keys));
  }, [keys, keysReady]);

  function clearVideo() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setVideoUrl(null);
  }

  function adoptVideo(blob: Blob) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setFileType(blob.type || "video/mp4");
    setVideoUrl(url);
  }

  const input = useMemo(
    () => ({ prompt, formatId, duration, aspect, edit: model.edit }),
    [prompt, formatId, duration, aspect, model.edit],
  );

  useEffect(() => {
    if (busy || videoUrl) return;
    let plan: ReelPlan;
    try {
      plan = planReel(input);
      setError("");
    } catch (err) {
      if (err instanceof PlanError) setError(err.message);
      return;
    }
    setDraft(plan);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = frameSize(plan.aspect);
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    void loadFonts().then(() => {
      if (canvasRef.current === canvas) drawFrame(ctx, plan, 0.45);
    });
  }, [input, busy, videoUrl]);

  function updatePrompt(value: string) {
    setPrompt(value);
    clearVideo();
    setResult(null);
  }

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1200);
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setBanner("");
    setError("");
    setPhase("Writing the cut");
    clearVideo();
    try {
      const loaded = await loadPlan(input);
      const plan = loaded.plan;
      setResult(plan);
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("The preview isn't on the page.");
      const size = frameSize(plan.aspect);
      canvas.width = size.width;
      canvas.height = size.height;

      const wired = Boolean(model.provider && model.access === "key");
      const provider = model.provider;
      const key = provider ? keys[keyName(provider)].trim() : "";
      if (wired && provider && key) {
        try {
          const blob = await runProvider(
            {
              model,
              prompt: `${plan.hook}. ${prompt}. ${plan.audio}`,
              aspect,
              duration,
              key,
              region: keys.region,
            },
            setPhase,
          );
          adoptVideo(blob);
          setEngine(model.name);
          setBanner(`${model.name} returned the video. The key stayed in this browser.`);
          setPhase("Ready");
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : "The model didn't return a video.";
          setBanner(`${model.name}: ${message} Playing the free cut instead.`);
        }
      } else if (model.id !== "reelroom") {
        setBanner(
          model.access === "key" && provider
            ? `${model.name} needs a ${keyLabel(provider)} saved in this browser. This cut was rendered free, on your device.`
            : `${model.name} isn't called from this free site. This cut uses that pace and was rendered on your device.`,
        );
      } else if (loaded.source === "gemini-2.5-flash") {
        setBanner("Gemini wrote the shot list. The video was rendered free on this device.");
      } else {
        setBanner("Rendered free on this device. No account and no key.");
      }

      const blob = await recordReel(canvas, plan, (ratio) => {
        setPhase(`Recording ${Math.round(ratio * 100)}%`);
      });
      adoptVideo(blob);
      setEngine("Reelroom");
      setPhase("Ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make that video.");
      setPhase("Ready when you are");
    } finally {
      setBusy(false);
    }
  }

  function surprise() {
    const format = FORMATS[Math.floor(Math.random() * FORMATS.length)];
    setFormatId(format.id);
    updatePrompt(format.example);
    setView("studio");
  }

  const shown = result ?? draft;
  const caption = shown ? `${shown.caption}\n\n${shown.hashtags.map((tag) => `#${tag}`).join(" ")}` : "";

  return (
    <>
      <header className="top">
        <a className="mark" href="#studio" onClick={() => setView("studio")}>
          <span className="mark-play" aria-hidden="true" />
          Reelroom
        </a>
        <nav>
          {(
            [
              ["studio", "Studio"],
              ["trends", "Trends"],
              ["models", "Models"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={view === id ? "on" : ""} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      {view === "trends" ? (
        <TrendBoard
          active={formatId}
          onPick={(id, example) => {
            setFormatId(id);
            updatePrompt(example);
            setView("studio");
          }}
        />
      ) : null}

      {view === "models" ? (
        <ModelBoard
          active={modelId}
          onPick={(id) => {
            setModelId(id);
            clearVideo();
            setResult(null);
            setView("studio");
          }}
        />
      ) : null}

      {view === "studio" ? (
        <main className="studio" id="studio">
          <section className="controls">
            <p className="kicker">Free vertical video</p>
            <h1>Cut a TikTok from a prompt.</h1>
            <p className="lede">
              Reelroom writes the hook and records a 9:16 video in your browser. Veo, Wan, and Seedance run when you
              save that provider's key. The key is not sent anywhere else, and the free cut never needs one.
            </p>

            <label htmlFor="prompt">Prompt</label>
            <textarea
              id="prompt"
              value={prompt}
              maxLength={800}
              onChange={(event) => updatePrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void generate();
                }
              }}
            />

            <div className="row">
              <button type="button" className="ghost" onClick={surprise}>
                Surprise me
              </button>
              <span className="hint">{prompt.trim().length}/800 · Ctrl+Enter</span>
            </div>

            <label>Trend format</label>
            <div className="chips">
              {FORMATS.map((format) => (
                <button
                  key={format.id}
                  type="button"
                  className={format.id === formatId ? "chip on" : "chip"}
                  onClick={() => {
                    setFormatId(format.id);
                    clearVideo();
                    setResult(null);
                  }}
                >
                  {format.name}
                </button>
              ))}
            </div>

            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={modelId}
              onChange={(event) => {
                setModelId(event.target.value);
                clearVideo();
                setResult(null);
              }}
            >
              {MODELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.access === "free" ? "free" : item.access === "key" ? "your key" : "free cut"}
                </option>
              ))}
            </select>
            <p className="hint">{model.blurb}</p>

            <div className="split">
              <fieldset>
                <legend>Length</legend>
                {[6, 8, 10].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    className={duration === seconds ? "chip on" : "chip"}
                    onClick={() => {
                      setDuration(seconds);
                      clearVideo();
                      setResult(null);
                    }}
                  >
                    {seconds}s
                  </button>
                ))}
              </fieldset>
              <fieldset>
                <legend>Frame</legend>
                {(["9:16", "1:1", "16:9"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={aspect === value ? "chip on" : "chip"}
                    onClick={() => {
                      setAspect(value);
                      clearVideo();
                      setResult(null);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </fieldset>
            </div>

            {model.provider ? (
              <div className="keys">
                <label htmlFor="apikey">{keyLabel(model.provider)}</label>
                <input
                  id="apikey"
                  type="password"
                  autoComplete="off"
                  placeholder="Stored in this browser only"
                  value={keys[keyName(model.provider)]}
                  onChange={(event) => {
                    const provider = model.provider;
                    if (!provider) return;
                    setKeys((current) => ({ ...current, [keyName(provider)]: event.target.value }));
                  }}
                />
                {model.provider !== "gemini" ? (
                  <div className="chips">
                    <button
                      type="button"
                      className={keys.region === "intl" ? "chip on" : "chip"}
                      onClick={() => setKeys((current) => ({ ...current, region: "intl" }))}
                    >
                      International
                    </button>
                    <button
                      type="button"
                      className={keys.region === "cn" ? "chip on" : "chip"}
                      onClick={() => setKeys((current) => ({ ...current, region: "cn" }))}
                    >
                      China mainland
                    </button>
                  </div>
                ) : null}
                <p className="hint">
                  Veo is 9:16 or 16:9. A square frame is sent to Veo as vertical. Provider video is billed to the key,
                  not to Reelroom.
                </p>
              </div>
            ) : null}

            <button type="button" className="generate" disabled={busy || prompt.trim().length < 3} onClick={() => void generate()}>
              <span className={busy ? "dot live" : "dot"} aria-hidden="true" />
              {busy ? phase : model.id === "reelroom" ? "Make the free video" : `Generate with ${model.name}`}
            </button>
            {error ? <p className="error">{error}</p> : null}
            {banner ? <p className="banner">{banner}</p> : null}
          </section>

          <section className="stage-wrap">
            <div className={`phone aspect-${aspect.replace(":", "-")}`}>
              <canvas ref={canvasRef} hidden={Boolean(videoUrl)} aria-label="Video preview" />
              {videoUrl ? <video src={videoUrl} controls playsInline autoPlay /> : null}
            </div>
            <div className="meta">
              <p>
                <span>Engine</span> {engine}
              </p>
              <p>
                <span>Format</span> {shown?.formatName ?? "—"}
              </p>
              {shown ? (
                <>
                  <p className="caption">{shown.caption}</p>
                  <p className="tags">{shown.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
                  <p className="hint">{shown.audio}</p>
                  <div className="row">
                    <button type="button" className="ghost" onClick={() => void copyText("caption", caption)}>
                      {copied === "caption" ? "Copied" : "Copy caption"}
                    </button>
                    {videoUrl ? (
                      <a className="ghost link" href={videoUrl} download={`reelroom.${fileExtension(fileType)}`}>
                        Download
                      </a>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </main>
      ) : null}

      <footer>
        Free cuts stay on this device. Veo calls Google, Wan calls Alibaba DashScope, and Seedance calls BytePlus
        ModelArk, using the key you paste. Reelroom does not keep the key or the file.
      </footer>
    </>
  );
}
