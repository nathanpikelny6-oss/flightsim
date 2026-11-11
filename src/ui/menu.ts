import type { AircraftChoice } from "../aircraft/traffic.ts";

export function mountMenu(
  root: HTMLElement,
  aircraft: AircraftChoice[],
  onSpawn: (id: string) => void,
): { show: () => void; hide: () => void } {
  root.innerHTML = `
    <div class="menu-card">
      <p class="menu-kicker">Flight</p>
      <h1>Choose an airplane</h1>
      <p class="menu-copy">It spawns at 280 m and the camera follows behind the tail. Drag the map if you want to look around.</p>
      <div class="menu-grid" id="aircraft-choices"></div>
    </div>
  `;
  const grid = root.querySelector("#aircraft-choices") as HTMLElement;
  for (const aircraftChoice of aircraft) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aircraft-choice";
    button.innerHTML = `<strong>${aircraftChoice.label}</strong><span>${aircraftChoice.detail}</span>`;
    button.addEventListener("click", () => onSpawn(aircraftChoice.id));
    grid.append(button);
  }
  return {
    show: () => root.classList.remove("hidden"),
    hide: () => root.classList.add("hidden"),
  };
}
