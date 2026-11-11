export type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  range: number;
  pitch: number;
  heading: number;
};

export const PLACES: Place[] = [
  { id: "alps", name: "Alps", lat: 45.92, lon: 7.05, range: 160_000, pitch: 58, heading: 28 },
  { id: "canyon", name: "Grand Canyon", lat: 36.1, lon: -112.14, range: 90_000, pitch: 62, heading: 210 },
  { id: "everest", name: "Everest", lat: 27.99, lon: 86.93, range: 70_000, pitch: 60, heading: 140 },
  { id: "fjords", name: "Fjords", lat: 62.12, lon: 7.07, range: 85_000, pitch: 64, heading: 40 },
  { id: "hawaii", name: "Hawaii", lat: 20.72, lon: -156.33, range: 120_000, pitch: 55, heading: 200 },
  { id: "iceland", name: "Iceland", lat: 64.05, lon: -16.98, range: 140_000, pitch: 57, heading: 310 },
  { id: "patagonia", name: "Patagonia", lat: -50.94, lon: -73.4, range: 130_000, pitch: 60, heading: 80 },
  { id: "sf", name: "Bay Area", lat: 37.7, lon: -122.35, range: 80_000, pitch: 58, heading: 150 },
];

export const DEFAULT_PLACE: Place = PLACES[0];
