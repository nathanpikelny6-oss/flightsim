import { useMemo, useState } from "react";
import { FORMATS } from "../shared/plan.ts";
import { MODELS } from "../shared/models.ts";

export function TrendBoard({ active, onPick }: { active: string; onPick: (id: string, example: string) => void }) {
  return (
    <main className="board">
      <p className="kicker">November 2026 formats</p>
      <h1>Trends you can film today.</h1>
      <p className="lede">
        AI Özil goal plays the touch, the curl, and the net. Hotel lobby walks the marble. The other cards are caption shapes: result first, wrong then right,
        the exact sentence, a before/after flash, three stacked versions, a chart people save, impatience comedy, a
        cringe confession, one idea per frame, and a single question answered without a fake number.
      </p>
      <div className="cards">
        {FORMATS.map((format) => (
          <article key={format.id} className={format.id === active ? "card on" : "card"}>
            <h2>{format.name}</h2>
            <p>{format.summary}</p>
            <p className="hint">{format.audio}</p>
            <button type="button" onClick={() => onPick(format.id, format.example)}>
              Use “{format.example}”
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}

export function ModelBoard({ active, onPick }: { active: string; onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const models = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return MODELS;
    const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return MODELS.filter((model) => pattern.test(`${model.name} ${model.family} ${model.blurb}`));
  }, [query]);
  const families = [...new Set(models.map((model) => model.family))];

  return (
    <main className="board">
      <p className="kicker">Model rack</p>
      <h1>Every model on the bench.</h1>
      <p className="lede">
        Reelroom Free always records here. Veo, Wan, and Seedance are live when a key is saved. The other names set the
        pace of the free cut. They are not silently relabeled as that company's video.
      </p>
      <label htmlFor="model-search">Find a model</label>
      <input id="model-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Veo, Wan, Seedance…" />
      {families.map((family) => (
        <section key={family}>
          <h2>{family}</h2>
          <div className="cards">
            {models
              .filter((model) => model.family === family)
              .map((model) => (
                <article key={model.id} className={model.id === active ? "card on" : "card"}>
                  <h3>{model.name}</h3>
                  <p>{model.blurb}</p>
                  <p className="hint">
                    {model.durations} · {model.sound}
                  </p>
                  <button type="button" onClick={() => onPick(model.id)}>
                    {model.id === active ? "Selected" : "Use this model"}
                  </button>
                </article>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
