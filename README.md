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

## Controls

- One finger / left drag: pan
- Pinch: zoom
- Two-finger twist: heading
- Two-finger vertical: pitch
- Right-drag or Ctrl-drag: orbit
- Place chips fly the camera to relief-heavy regions
