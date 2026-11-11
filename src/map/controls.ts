import { PerspectiveCamera, Vector3 } from "three/webgpu";
import {
  clamp,
  destination,
  geodeticToEcef,
  MAX_MERCATOR_LAT,
} from "./wgs84.ts";
import type { Place } from "./places.ts";

export type GlobeView = {
  lat: number;
  lon: number;
  range: number;
  pitch: number;
  heading: number;
  focusHeight: number;
};

const MIN_RANGE = 40;
const MAX_RANGE = 40_000;

export class GlobeControls {
  view: GlobeView;
  private readonly camera: PerspectiveCamera;
  private readonly canvas: HTMLElement;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private lastPinch = 0;
  private lastAngle = 0;
  private lastMidY = 0;
  private velEast = 0;
  private velNorth = 0;
  private velRange = 0;
  private velHeading = 0;
  private velPitch = 0;
  private lastTap = 0;
  private moving = false;
  userSteering = false;

  constructor(camera: PerspectiveCamera, canvas: HTMLElement, start: Place) {
    this.camera = camera;
    this.canvas = canvas;
    this.view = {
      lat: start.lat,
      lon: start.lon,
      range: start.range,
      pitch: start.pitch,
      heading: start.heading,
      focusHeight: 0,
    };
    this.bind();
    this.apply();
  }

  flyTo(place: Place & { focusHeight?: number }): void {
    this.view.lat = place.lat;
    this.view.lon = place.lon;
    this.view.range = place.range;
    this.view.pitch = place.pitch;
    this.view.heading = place.heading;
    this.view.focusHeight = place.focusHeight ?? 0;
    this.userSteering = true;
    this.velEast = this.velNorth = this.velRange = this.velHeading = this.velPitch = 0;
    this.apply();
  }

  follow(lat: number, lon: number, heading: number, altitude: number): void {
    this.view.lat = lat;
    this.view.lon = lon;
    this.view.heading = heading;
    this.view.focusHeight = altitude;
    this.view.range = 260;
    this.view.pitch = 76;
    this.userSteering = false;
    this.velEast = this.velNorth = this.velRange = this.velHeading = this.velPitch = 0;
    this.apply();
  }

  setCoords(lat: number, lon: number): void {
    this.view.lat = clamp(lat, -MAX_MERCATOR_LAT + 0.3, MAX_MERCATOR_LAT - 0.3);
    this.view.lon = lon;
    this.apply();
  }

  private readonly origin = new Vector3();

  getOrigin(target = this.origin): Vector3 {
    const ecef = geodeticToEcef(this.view.lat, this.view.lon, 0);
    return target.set(ecef.x, ecef.y, ecef.z);
  }

  update(dt: number): void {
    if (this.moving) return;
    const damp = Math.exp(-dt * 4.2);
    this.pan(this.velEast * dt, this.velNorth * dt);
    this.view.range = clamp(this.view.range + this.velRange * dt, MIN_RANGE, MAX_RANGE);
    this.view.heading = (this.view.heading + this.velHeading * dt + 360) % 360;
    this.view.pitch = clamp(this.view.pitch + this.velPitch * dt, 32, 80);
    this.velEast *= damp;
    this.velNorth *= damp;
    this.velRange *= damp;
    this.velHeading *= damp;
    this.velPitch *= damp;
    this.apply();
  }

  apply(): void {
    const { range, pitch, heading, focusHeight } = this.view;
    const headingRad = (heading * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const horiz = Math.sin(pitchRad) * range;
    const vert = Math.cos(pitchRad) * range;
    const east = Math.sin(headingRad);
    const north = Math.cos(headingRad);
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(-east * horiz, vert + focusHeight, -north * horiz);
    this.camera.lookAt(0, focusHeight, 0);
    const near = clamp(range * 0.01, 0.25, 4);
    const far = clamp(range * 60 + 8_000, 4_000, 250_000);
    if (this.camera.near !== near || this.camera.far !== far) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKey);
  }

  private bind(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.canvas.setPointerCapture(event.pointerId);
    this.view.focusHeight = 0;
    this.userSteering = true;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.moving = true;
    this.velEast = this.velNorth = this.velRange = this.velHeading = this.velPitch = 0;
    if (this.pointers.size === 1 && event.pointerType === "touch") {
      const now = performance.now();
      if (now - this.lastTap < 280) {
        this.view.range = clamp(this.view.range * 0.45, MIN_RANGE, MAX_RANGE);
      }
      this.lastTap = now;
    }
    if (this.pointers.size === 2) this.capturePinch();
  };

  private onPointerMove = (event: PointerEvent): void => {
    const prev = this.pointers.get(event.pointerId);
    if (!prev) return;
    const next = { x: event.clientX, y: event.clientY };
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    this.pointers.set(event.pointerId, next);

    if (this.pointers.size === 1) {
      if (event.ctrlKey || event.buttons === 2) {
        this.view.heading = (this.view.heading - dx * 0.22 + 360) % 360;
        this.view.pitch = clamp(this.view.pitch - dy * 0.16, 32, 80);
        this.velHeading = -dx * 4;
        this.velPitch = -dy * 3;
      } else {
        this.panPixels(dx, dy);
      }
    } else if (this.pointers.size === 2) {
      this.updatePinch();
    }
    this.apply();
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) {
      this.lastPinch = 0;
    }
    if (this.pointers.size === 0) this.moving = false;
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.0014);
    this.view.range = clamp(this.view.range * factor, MIN_RANGE, MAX_RANGE);
    this.velRange = this.view.range * (factor - 1) * 18;
    this.apply();
  };

  private onKey = (event: KeyboardEvent): void => {
    const step = this.view.range * 0.08;
    if (event.key === "ArrowLeft") this.pan(-step, 0);
    if (event.key === "ArrowRight") this.pan(step, 0);
    if (event.key === "ArrowUp") this.pan(0, step);
    if (event.key === "ArrowDown") this.pan(0, -step);
    if (event.key === "+" || event.key === "=") this.view.range = clamp(this.view.range * 0.82, MIN_RANGE, MAX_RANGE);
    if (event.key === "-" || event.key === "_") this.view.range = clamp(this.view.range * 1.22, MIN_RANGE, MAX_RANGE);
    this.apply();
  };

  private panPixels(dx: number, dy: number): void {
    const meters =
      (this.view.range * 2 * Math.tan((this.camera.fov * Math.PI) / 360)) / this.canvas.clientHeight;
    const headingRad = (this.view.heading * Math.PI) / 180;
    const east = -dx * meters * Math.cos(headingRad) + dy * meters * Math.sin(headingRad);
    const north = dx * meters * Math.sin(headingRad) + dy * meters * Math.cos(headingRad);
    this.pan(east, north);
    this.velEast = east * 18;
    this.velNorth = north * 18;
  }

  private pan(eastMeters: number, northMeters: number): void {
    const next = destination(this.view.lat, this.view.lon, eastMeters, northMeters);
    this.view.lat = next.lat;
    this.view.lon = next.lon;
  }

  private capturePinch(): void {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    this.lastPinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    this.lastAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    this.lastMidY = (pts[0].y + pts[1].y) * 0.5;
  }

  private updatePinch(): void {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    if (this.lastPinch > 0) {
      const zoom = this.lastPinch / Math.max(1, dist);
      this.view.range = clamp(this.view.range * zoom, MIN_RANGE, MAX_RANGE);
      this.velRange = this.view.range * (zoom - 1) * 20;
      let delta = ((angle - this.lastAngle) * 180) / Math.PI;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      this.view.heading = (this.view.heading - delta + 360) % 360;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      this.view.pitch = clamp(this.view.pitch + (midY - this.lastMidY) * 0.18, 32, 80);
      this.lastMidY = midY;
    }
    this.lastPinch = dist;
    this.lastAngle = angle;
  }
}
