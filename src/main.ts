import "./style.css";
import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  PerspectiveCamera,
  Scene,
  WebGPURenderer,
} from "three/webgpu";
import { TerrainMap } from "./map/terrain.ts";
import { GlobeControls } from "./map/controls.ts";
import { DEFAULT_PLACE } from "./map/places.ts";
import { mountHud } from "./ui/hud.ts";
import { mountMenu } from "./ui/menu.ts";
import { AirTraffic } from "./aircraft/traffic.ts";

const canvas = document.querySelector("#globe") as HTMLCanvasElement;
const overlay = document.querySelector("#hud") as HTMLElement;
const splash = document.querySelector("#splash") as HTMLElement;
const splashStatus = document.querySelector("#splash-status") as HTMLElement;
const menuRoot = document.querySelector("#menu") as HTMLElement;

const isMobile = window.matchMedia("(pointer: coarse), (max-width: 820px)").matches;
const quality = isMobile ? "mobile" : "desktop";

async function boot(): Promise<void> {
  splashStatus.textContent = "Starting WebGPU…";

  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(new Color("#8eb4d0"));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  await renderer.init();

  const usingWebGPU = Boolean(
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend,
  );
  const backend = usingWebGPU ? "WebGPU" : "WebGL2 fallback";
  splashStatus.textContent = "Loading aircraft…";

  const scene = new Scene();
  scene.background = new Color("#8eb4d0");
  scene.fog = new Fog("#8eb4d0", 12_000, 80_000);
  const camera = new PerspectiveCamera(isMobile ? 58 : 50, window.innerWidth / window.innerHeight, 1, 80_000);
  const terrain = new TerrainMap(quality);
  const traffic = new AirTraffic();
  scene.add(terrain.group, traffic.group, ...traffic.lights);

  const controls = new GlobeControls(camera, canvas, DEFAULT_PLACE);
  await traffic.load();

  const menu = mountMenu(menuRoot, traffic.catalog(), (id) => {
    const flight = traffic.spawn(id, controls.view.lat, controls.view.lon, controls.view.heading);
    if (!flight) return;
    controls.follow(flight.lat, flight.lon, flight.heading, flight.altitude);
    menu.hide();
  });

  const hud = mountHud(overlay, {
    setPlace: (place) => controls.flyTo(place),
    setExaggeration: (value) => terrain.setExaggeration(value),
    locate: () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => controls.setCoords(pos.coords.latitude, pos.coords.longitude),
        () => undefined,
        { enableHighAccuracy: true, timeout: 8000 },
      );
    },
    openMenu: () => menu.show(),
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
  splash.classList.add("hidden");
  menu.show();

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
    traffic.update(dt, controls.view.lat, controls.view.lon);
    const chased = traffic.latest();
    if (chased && !controls.userSteering) {
      controls.follow(chased.lat, chased.lon, chased.heading, chased.altitude);
      traffic.place(controls.view.lat, controls.view.lon);
    }
    terrain.update(camera, controls.view.lat, controls.view.lon, controls.view.range);
    const fog = scene.fog as Fog;
    fog.near = 700;
    fog.far = 4200;
    hud.update(controls.view, { fps, backend, tiles: terrain.getStats().tiles });
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
