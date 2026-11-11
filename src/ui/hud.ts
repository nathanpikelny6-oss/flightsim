import { PLACES, type Place } from "../map/places.ts";
import type { GlobeView } from "../map/controls.ts";

export type HudApi = {
  setPlace: (place: Place) => void;
  setExaggeration: (value: number) => void;
  locate: () => void;
};

function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${ns}  ${Math.abs(lon).toFixed(3)}°${ew}`;
}

function formatAlt(range: number): string {
  if (range >= 1_000_000) return `${(range / 1_000_000).toFixed(1)} Mm`;
  if (range >= 1000) return `${Math.round(range / 1000)} km`;
  return `${Math.round(range)} m`;
}

export function mountHud(root: HTMLElement, api: HudApi): {
  update: (view: GlobeView, extras: { fps: number; backend: string; tiles: number }) => void;
} {
  root.innerHTML = `
    <div class="hud-top">
      <div class="brand">
        <span class="mark">FS</span>
        <div>
          <strong>Flight Map</strong>
          <small id="backend">starting</small>
        </div>
      </div>
      <div class="readout">
        <span id="coords">—</span>
        <span id="alt">—</span>
        <span id="fps">—</span>
      </div>
    </div>
    <div class="hud-bottom">
      <div class="places" id="places"></div>
      <div class="tools">
        <label class="relief">
          Relief
          <input id="exag" type="range" min="0.4" max="3.2" step="0.1" value="1.7" />
        </label>
        <button type="button" id="locate" class="locate">My location</button>
      </div>
      <p class="hint">Drag to pan · pinch to zoom · two-finger twist to turn</p>
    </div>
  `;

  const placesEl = root.querySelector("#places") as HTMLElement;
  for (const place of PLACES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = place.name;
    button.addEventListener("click", () => api.setPlace(place));
    placesEl.append(button);
  }

  const exag = root.querySelector("#exag") as HTMLInputElement;
  exag.addEventListener("input", () => api.setExaggeration(Number(exag.value)));
  root.querySelector("#locate")?.addEventListener("click", () => api.locate());

  const coords = root.querySelector("#coords") as HTMLElement;
  const alt = root.querySelector("#alt") as HTMLElement;
  const fps = root.querySelector("#fps") as HTMLElement;
  const backend = root.querySelector("#backend") as HTMLElement;

  return {
    update(view, extras) {
      coords.textContent = formatCoord(view.lat, view.lon);
      alt.textContent = `AGL ${formatAlt(view.range)}`;
      fps.textContent = `${extras.fps} fps · ${extras.tiles} tiles`;
      backend.textContent = extras.backend;
    },
  };
}
