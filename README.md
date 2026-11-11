# Flight Map

Mobile-first 3D globe for a browser flight sim. This first slice is the map: WebGPU terrain, satellite imagery, and touch orbit/pan.

## Stack

- Vite + TypeScript
- Three.js `WebGPURenderer` (WebGL2 fallback if WebGPU is unavailable)
- GPU height displacement from Mapzen Terrarium tiles
- Esri World Imagery color tiles
- Same-origin terrain proxy for CORS (`/tiles/terrain/{z}/{x}/{y}`)

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
