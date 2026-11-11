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
  { id: "sfo", name: "San Francisco", lat: 37.62, lon: -122.38, range: 2_200, pitch: 42, heading: 120 },
  { id: "alps", name: "Alps", lat: 45.92, lon: 7.05, range: 4_500, pitch: 48, heading: 28 },
  { id: "canyon", name: "Grand Canyon", lat: 36.1, lon: -112.14, range: 3_200, pitch: 50, heading: 210 },
  { id: "everest", name: "Everest", lat: 27.99, lon: 86.93, range: 5_000, pitch: 46, heading: 140 },
  { id: "fjords", name: "Fjords", lat: 62.12, lon: 7.07, range: 3_800, pitch: 48, heading: 40 },
  { id: "hawaii", name: "Hawaii", lat: 20.72, lon: -156.33, range: 4_000, pitch: 44, heading: 200 },
  { id: "iceland", name: "Iceland", lat: 64.05, lon: -16.98, range: 4_200, pitch: 46, heading: 310 },
  { id: "london", name: "London", lat: 51.47, lon: -0.46, range: 2_400, pitch: 42, heading: 90 },
];

export const DEFAULT_PLACE: Place = PLACES[0];
