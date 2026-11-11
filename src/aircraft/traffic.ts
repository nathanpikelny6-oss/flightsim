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
import { destination, eastVector, geodeticToEcef, northVector } from "../map/wgs84.ts";

type AircraftSpec = {
  id: string;
  label: string;
  file: string;
  length: number;
  nose: "x" | "y" | "z";
  up: "x" | "y" | "z";
  altitude: number;
  speed: number;
};

const SPECS: AircraftSpec[] = [
  { id: "B737", label: "737", file: "B737_nologo.glb", length: 39.5, nose: "x", up: "y", altitude: 10600, speed: 230 },
  { id: "A320", label: "A320", file: "A320_nologo.glb", length: 37.6, nose: "y", up: "z", altitude: 10400, speed: 230 },
  { id: "B787", label: "787", file: "B787_nologo.glb", length: 56.7, nose: "z", up: "y", altitude: 11800, speed: 250 },
  { id: "A350", label: "A350", file: "A350_nologo.glb", length: 66.8, nose: "x", up: "z", altitude: 12000, speed: 250 },
  { id: "A380", label: "A380", file: "A380_nologo.glb", length: 72.7, nose: "y", up: "z", altitude: 11900, speed: 250 },
];

type Flight = {
  spec: AircraftSpec;
  object: Object3D;
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

const ROUTES: Array<{ spec: string; lat: number; lon: number; heading: number }> = [
  { spec: "B737", lat: 46.2, lon: 7.4, heading: 70 },
  { spec: "A320", lat: 45.6, lon: 6.4, heading: 250 },
  { spec: "B787", lat: 36.3, lon: -112.4, heading: 120 },
  { spec: "A350", lat: 37.9, lon: -122.6, heading: 300 },
  { spec: "A380", lat: 20.9, lon: -156.6, heading: 40 },
  { spec: "B737", lat: 64.2, lon: -17.4, heading: 200 },
  { spec: "A320", lat: 51.4, lon: -0.5, heading: 90 },
  { spec: "B787", lat: 35.6, lon: 139.7, heading: 160 },
];

export class AirTraffic {
  readonly group = new Group();
  readonly lights: Object3D[] = [];
  private readonly flights: Flight[] = [];
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly forward = new Vector3();
  private readonly basis = new Matrix4();
  private readonly box = new Box3();
  private readonly boxSize = new Vector3();
  ready = false;

  constructor() {
    const ambient = new AmbientLight("#d7e6ff", 0.7);
    const sun = new DirectionalLight("#fff4e0", 2.4);
    sun.position.set(180_000, 320_000, 90_000);
    this.lights.push(ambient, sun);
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    const templates = new Map<string, Object3D>();
    await Promise.all(SPECS.map(async (spec) => {
      const gltf = await loader.loadAsync(`/aircraft/${spec.file}`);
      const mesh = gltf.scene;
      const measured = this.axisLength(mesh, spec.nose);
      const nose = AXIS[spec.nose];
      const up = AXIS[spec.up];
      const right = new Vector3().crossVectors(nose, up).normalize();
      mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(nose, up, right));
      mesh.scale.setScalar(spec.length / measured);
      mesh.updateMatrix();
      const holder = new Group();
      holder.add(mesh);
      templates.set(spec.id, holder);
    }));

    for (const route of ROUTES) {
      const spec = SPECS.find((item) => item.id === route.spec);
      const template = templates.get(route.spec);
      if (!spec || !template) continue;
      const object = template.clone(true);
      this.group.add(object);
      this.flights.push({
        spec,
        object,
        lat: route.lat,
        lon: route.lon,
        heading: route.heading,
        altitude: spec.altitude,
      });
    }
    this.ready = true;
  }

  nearest(lat: number, lon: number): Flight | null {
    let best: Flight | null = null;
    let bestScore = Infinity;
    for (const flight of this.flights) {
      const score = (flight.lat - lat) ** 2 + (flight.lon - lon) ** 2;
      if (score < bestScore) {
        best = flight;
        bestScore = score;
      }
    }
    return best;
  }

  update(dt: number, origin: Vector3): void {
    for (const flight of this.flights) {
      const step = flight.spec.speed * dt;
      const headingRad = (flight.heading * Math.PI) / 180;
      const next = destination(flight.lat, flight.lon, Math.sin(headingRad) * step, Math.cos(headingRad) * step);
      flight.lat = next.lat;
      flight.lon = next.lon;
      this.place(flight, origin);
    }
  }

  private place(flight: Flight, origin: Vector3): void {
    const ecef = geodeticToEcef(flight.lat, flight.lon, flight.altitude);
    flight.object.position.set(ecef.x - origin.x, ecef.y - origin.y, ecef.z - origin.z);
    const east = eastVector(flight.lon);
    const north = northVector(flight.lat, flight.lon);
    const normal = geodeticToEcef(flight.lat, flight.lon, 0);
    const normalLen = Math.hypot(normal.x, normal.y, normal.z);
    this.up.set(normal.x / normalLen, normal.y / normalLen, normal.z / normalLen);
    const headingRad = (flight.heading * Math.PI) / 180;
    this.forward.set(
      east.x * Math.sin(headingRad) + north.x * Math.cos(headingRad),
      east.y * Math.sin(headingRad) + north.y * Math.cos(headingRad),
      east.z * Math.sin(headingRad) + north.z * Math.cos(headingRad),
    );
    this.right.crossVectors(this.forward, this.up).normalize();
    this.forward.crossVectors(this.up, this.right).normalize();
    this.basis.makeBasis(this.forward, this.up, this.right);
    flight.object.quaternion.setFromRotationMatrix(this.basis);
  }

  private axisLength(object: Object3D, axis: "x" | "y" | "z"): number {
    object.updateWorldMatrix(true, true);
    this.box.setFromObject(object);
    this.box.getSize(this.boxSize);
    return Math.max(1, this.boxSize[axis]);
  }
}
