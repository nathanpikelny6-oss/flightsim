# Flight Map

Mobile-first flat terrain map for a browser flight sim. WebGPU draws satellite imagery and elevation in a local east-north-up frame. A spawn menu opens after the aircraft files load.

## Stack

- Vite + TypeScript
- Three.js `WebGPURenderer` (WebGL2 fallback if WebGPU is unavailable)
- GPU height displacement from Mapzen Terrarium tiles
- Esri World Imagery color tiles
- Same-origin terrain proxy for CORS (`/tiles/terrain/{z}/{x}/{y}`)

## Hosting

GitHub Pages can serve the built site. Elevation now comes from Esri's terrain service, which allows browser requests, so no tile proxy is required. Pushing `main` runs `.github/workflows/pages.yml`.

In the repo on GitHub, open Settings, then Pages, and set the source to GitHub Actions. The site is published at `https://nathanpikelny6-oss.github.io/flightsim/`. Moving to your own domain later is an upload of the same `dist` folder, or a DNS record pointed at whatever host you choose. Use `npm run build` without `GITHUB_PAGES` so asset paths stay at the domain root.

## Local

```bash
npm install
npm run dev
```

Open the printed local URL on a phone on the same network, or use Chrome DevTools device mode.

## Aircraft

Logo-free A320, A350, A380, 737, and 787 meshes are in `public/aircraft/`. They are by amvlab under CC BY 4.0. See `public/aircraft/CREDITS.md`. Boeing and Airbus do not publish the rest of the fleet for reuse, so those types are not in the app.

## Controls

- One finger / left drag: pan
- Pinch: zoom
- Two-finger twist: heading
- Two-finger vertical: pitch
- Right-drag or Ctrl-drag: orbit
- Place chips fly the camera to relief-heavy regions
- Watch traffic moves the camera to the nearest airplane. Open `#watch` to start on that view.
