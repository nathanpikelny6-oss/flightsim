import "./style.css";
import {
  ACESFilmicToneMapping,
  Color,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { GlobeMap } from "./map/globe.ts";
import { GlobeControls } from "./map/controls.ts";
import { createAtmosphere, createStarfield } from "./map/atmosphere.ts";
import { DEFAULT_PLACE } from "./map/places.ts";
import { mountHud } from "./ui/hud.ts";
import { AirTraffic } from "./aircraft/traffic.ts";

const canvas = document.querySelector("#globe") as HTMLCanvasElement;
const overlay = document.querySelector("#hud") as HTMLElement;
const splash = document.querySelector("#splash") as HTMLElement;
const splashStatus = document.querySelector("#splash-status") as HTMLElement;

const isMobile = window.matchMedia("(pointer: coarse), (max-width: 820px)").matches;
const quality = isMobile ? "mobile" : "desktop";

async function boot(): Promise<void> {
  splashStatus.textContent = "Starting WebGPU…";

  const renderer = new WebGPURenderer({
    canvas,
    antialias: !isMobile,
    alpha: false,
    powerPreference: "high-performance",
    logarithmicDepthBuffer: true,
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(new Color("#02040a"));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.45 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  await renderer.init();

  const usingWebGPU = Boolean(
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend,
  );
  const backend = usingWebGPU ? "WebGPU" : "WebGL2 fallback";
  splashStatus.textContent = `Renderer: ${backend}`;

  const scene = new Scene();
  const camera = new PerspectiveCamera(isMobile ? 62 : 55, window.innerWidth / window.innerHeight, 20, 40_000_000);
  const globe = new GlobeMap(quality);
  const atmosphere = createAtmosphere();
  const stars = createStarfield();
  const traffic = new AirTraffic();
  scene.add(stars, atmosphere, globe.group, traffic.group, ...traffic.lights);

  const controls = new GlobeControls(camera, canvas, DEFAULT_PLACE);
  const origin = new Vector3();

  const hud = mountHud(overlay, {
    setPlace: (place) => controls.flyTo(place),
    setExaggeration: (value) => globe.setExaggeration(value),
    watchTraffic: () => {
      const flight = traffic.nearest(controls.view.lat, controls.view.lon);
      if (!flight) return;
      controls.flyTo({
        id: "traffic",
        name: flight.spec.label,
        lat: flight.lat,
        lon: flight.lon,
        range: 320,
        pitch: 62,
        heading: flight.heading,
        focusHeight: flight.altitude,
      });
    },
    locate: () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => controls.setCoords(pos.coords.latitude, pos.coords.longitude),
        () => undefined,
        { enableHighAccuracy: true, timeout: 8000 },
      );
    },
  });

  const onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  let frames = 0;
  let fps = 0;
  let fpsStamp = performance.now();
  let last = performance.now();
  splashStatus.textContent = "Loading aircraft…";
  await traffic.load();
  if (location.hash === "#watch") {
    const flight = traffic.nearest(controls.view.lat, controls.view.lon);
    if (flight) {
      controls.flyTo({
        id: "traffic",
        name: flight.spec.label,
        lat: flight.lat,
        lon: flight.lon,
        range: 320,
        pitch: 62,
        heading: flight.heading,
        focusHeight: flight.altitude,
      });
    }
  }
  splash.classList.add("hidden");

  const frame = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frames += 1;
    if (now - fpsStamp >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsStamp));
      frames = 0;
      fpsStamp = now;
    }

    controls.update(dt);
    controls.getOrigin(origin);
    atmosphere.position.copy(origin).multiplyScalar(-1);
    stars.position.copy(atmosphere.position);
    globe.update(camera, canvas.clientHeight, origin);
    traffic.update(dt, origin);
    hud.update(controls.view, { fps, backend, tiles: globe.getStats().tiles });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

boot().catch((error: unknown) => {
  splash.classList.remove("hidden");
  splashStatus.textContent =
    error instanceof Error ? error.message : "WebGPU failed to start on this device.";
});
