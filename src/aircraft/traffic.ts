import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Matrix4,
  Object3D,
  Vector3,
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { destination, offsetMeters } from "../map/wgs84.ts";

export type AircraftChoice = {
  id: string;
  label: string;
  detail: string;
};

type AircraftSpec = AircraftChoice & {
  file: string;
  length: number;
  nose: "x" | "y" | "z";
  up: "x" | "y" | "z";
  speed: number;
};

const SPECS: AircraftSpec[] = [
  { id: "B737", label: "737", detail: "Narrow-body twinjet", file: "B737_nologo.glb", length: 39.5, nose: "x", up: "y", speed: 120 },
  { id: "A320", label: "A320", detail: "Narrow-body twinjet", file: "A320_nologo.glb", length: 37.6, nose: "y", up: "z", speed: 120 },
  { id: "B787", label: "787", detail: "Long-haul twinjet", file: "B787_nologo.glb", length: 56.7, nose: "z", up: "y", speed: 140 },
  { id: "A350", label: "A350", detail: "Long-haul twinjet", file: "A350_nologo.glb", length: 66.8, nose: "x", up: "z", speed: 140 },
  { id: "A380", label: "A380", detail: "Double-deck quadjet", file: "A380_nologo.glb", length: 72.7, nose: "y", up: "z", speed: 145 },
];

export type SpawnedFlight = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  heading: number;
  altitude: number;
};

const AXIS: Record<"x" | "y" | "z", Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

type Flight = SpawnedFlight & {
  spec: AircraftSpec;
  object: Object3D;
};

export class AirTraffic {
  readonly group = new Group();
  readonly lights: Object3D[] = [];
  private readonly templates = new Map<string, Object3D>();
  private readonly flights: Flight[] = [];
  private readonly box = new Box3();
  private readonly boxSize = new Vector3();

  constructor() {
    const ambient = new AmbientLight("#f4f7fb", 0.85);
    const sun = new DirectionalLight("#fff6e8", 2.1);
    sun.position.set(400, 900, 200);
    this.lights.push(ambient, sun);
  }

  catalog(): AircraftChoice[] {
    return SPECS.map(({ id, label, detail }) => ({ id, label, detail }));
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    await Promise.all(SPECS.map(async (spec) => {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}aircraft/${spec.file}`);
      const mesh = gltf.scene;
      const measured = this.axisLength(mesh, spec.nose);
      const nose = AXIS[spec.nose];
      const up = AXIS[spec.up];
      const right = new Vector3().crossVectors(nose, up).normalize();
      mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(nose, up, right));
      mesh.scale.setScalar(spec.length / measured);
      const holder = new Group();
      holder.add(mesh);
      this.templates.set(spec.id, holder);
    }));
  }

  spawn(id: string, lat: number, lon: number, heading: number): SpawnedFlight | null {
    const spec = SPECS.find((item) => item.id === id);
    const template = this.templates.get(id);
    if (!spec || !template) return null;
    if (this.flights.length >= 6) {
      const oldest = this.flights.shift();
      if (oldest) this.group.remove(oldest.object);
    }
    const object = template.clone(true);
    this.group.add(object);
    const flight: Flight = {
      id: spec.id,
      label: spec.label,
      spec,
      object,
      lat,
      lon,
      heading,
      altitude: 120,
    };
    this.flights.push(flight);
    return flight;
  }

  latest(): SpawnedFlight | null {
    return this.flights[this.flights.length - 1] ?? null;
  }

  update(dt: number, originLat: number, originLon: number): void {
    for (const flight of this.flights) {
      const step = flight.spec.speed * dt;
      const headingRad = (flight.heading * Math.PI) / 180;
      const next = destination(flight.lat, flight.lon, Math.sin(headingRad) * step, Math.cos(headingRad) * step);
      flight.lat = next.lat;
      flight.lon = next.lon;
    }
    this.place(originLat, originLon);
  }

  place(originLat: number, originLon: number): void {
    for (const flight of this.flights) {
      const headingRad = (flight.heading * Math.PI) / 180;
      const local = offsetMeters(originLat, originLon, flight.lat, flight.lon);
      flight.object.position.set(local.east, flight.altitude, local.north);
      flight.object.rotation.set(0, headingRad - Math.PI / 2, 0);
    }
  }

  private axisLength(object: Object3D, axis: "x" | "y" | "z"): number {
    object.updateWorldMatrix(true, true);
    this.box.setFromObject(object);
    this.box.getSize(this.boxSize);
    return Math.max(1, this.boxSize[axis]);
  }
}
