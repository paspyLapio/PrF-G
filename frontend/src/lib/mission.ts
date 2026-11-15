import type { DesignPoint, Gravity, Item } from "./engine";

export type AtmKey = "launch" | "transit" | "surface";
/** How a phase is drawn on the trajectory canvas. */
export type Shape = "pad" | "ascent" | "orbit" | "phasing" | "docked" | "transfer" | "dorbit" | "nrho" | "surface";
export type Dest = "moon" | "mars" | "station";
export interface Phase { id: string; name: string; real: number; demo: number; g: Gravity; gval: number; atm: AtmKey; shape: Shape; caption: string }
export interface Mission {
  id: string; name: string; blurb: string; dest: Dest; route: Phase[];
  u: number; band: number; trendMin: number; det: "inhibit" | "always";
  atm: Record<AtmKey, DesignPoint>; inv: Item[];
  /** Vehicle inputs for the fire-consequence model (every spacecraft is different). Defaults: Orion habitable
   *  volume 330 ft³ = 9.3 m³ (NASA), ISS 388 m³ (NASA); burst: Apollo 204 rupture pressure, reference only. */
  volume: number; burst: number;
}

export const SURFACE_RATE = 60; // open-ended last phase: 1 simulated minute per second
export const START_MET = -60;

const pad = (): Phase => ({ id: "pad", name: "Pre-launch", real: 60, demo: 4, g: "1g", gval: 1, atm: "launch", shape: "pad", caption: "Crew strapped in. PrF-G on standby: launch materials are covered by 1 g ground certification (NASA-STD-6001)." });
const ascent = (): Phase => ({ id: "ascent", name: "Ascent", real: 510, demo: 12, g: "1g", gval: 1, atm: "launch", shape: "ascent", caption: "Liftoff. PrF-G stays on standby under launch loads." });
const leo = (demo = 6): Phase => ({ id: "leo", name: "Earth orbit", real: 7200, demo, g: "micro", gval: 0, atm: "launch", shape: "orbit", caption: "Microgravity. Screening starts: every exposed material is checked against NASA test evidence." });

export const ROUTES: Record<string, Phase[]> = {
  lunar: [pad(), ascent(), leo(),
    { id: "tli", name: "Translunar", real: 259200, demo: 12, g: "micro", gval: 0, atm: "transit", shape: "transfer", caption: "Translunar coast. Cabin moves to {o2}% O₂ at {psia} psia; materials outside NASA's tested range are flagged." },
    { id: "llo", name: "Lunar orbit", real: 86400, demo: 6, g: "micro", gval: 0, atm: "transit", shape: "dorbit", caption: "Lunar orbit, then powered descent." },
    { id: "surf", name: "Lunar surface", real: Infinity, demo: Infinity, g: "partial", gval: 0.166, atm: "surface", shape: "surface", caption: "Habitat at {o2}% O₂, {psia} psia, 0.166 g. NASA has no partial-gravity fire data, and PrF-G says so." }],
  station: [pad(), ascent(),
    { id: "phase", name: "Phasing", real: 100800, demo: 10, g: "micro", gval: 0, atm: "launch", shape: "phasing", caption: "Phasing orbits to catch the station. Microgravity: screening is on." },
    { id: "dock", name: "Docked", real: Infinity, demo: Infinity, g: "micro", gval: 0, atm: "transit", shape: "docked", caption: "Docked. Hatches open: station air at {o2}% O₂ and {psia} psia, crew and cargo mix." }],
  gateway: [pad(), ascent(), leo(5),
    { id: "tli", name: "Translunar", real: 388800, demo: 12, g: "micro", gval: 0, atm: "transit", shape: "transfer", caption: "Translunar coast at {o2}% O₂ and {psia} psia." },
    { id: "nrho", name: "Gateway NRHO", real: Infinity, demo: Infinity, g: "micro", gval: 0, atm: "surface", shape: "nrho", caption: "Docked to a lunar outpost in a near-rectilinear halo orbit. Microgravity, {o2}% O₂ at {psia} psia." }],
  mars: [pad(), ascent(), leo(5),
    { id: "tmi", name: "Mars cruise", real: 18144000, demo: 16, g: "micro", gval: 0, atm: "transit", shape: "transfer", caption: "Seven-month cruise at {o2}% O₂ and {psia} psia. No Mission Control in the loop: one-way light time grows to many minutes." },
    { id: "mo", name: "Mars orbit", real: 172800, demo: 6, g: "micro", gval: 0, atm: "transit", shape: "dorbit", caption: "Mars orbit, then entry, descent and landing." },
    { id: "msurf", name: "Mars surface", real: Infinity, demo: Infinity, g: "partial", gval: 0.38, atm: "surface", shape: "surface", caption: "Habitat at {o2}% O₂, {psia} psia, 0.38 g. NASA has no partial-gravity fire data, and PrF-G says so." }],
};

export const phaseStarts = (route: Phase[]): number[] => { let t = START_MET; return route.map((p) => { const s = t; t += p.real; return s; }); };
export const phaseIndex = (route: Phase[], met: number) => { let i = 0; phaseStarts(route).forEach((s, k) => { if (met >= s) i = k; }); return i; };
export const phaseProgress = (route: Phase[], met: number) => {
  const i = phaseIndex(route, met), p = route[i], s = phaseStarts(route)[i];
  return p.real === Infinity ? Math.min(1, (met - s) / 1800) : Math.min(1, Math.max(0, (met - s) / p.real));
};
export const caption = (p: Phase, d: DesignPoint) => p.caption.replace("{o2}", d.o2.toFixed(1)).replace("{psia}", String(d.psia));

const BURST_NOTE = 29; // psia: Apollo 204 command module ruptured at "at least 29 psia" (reference only; enter your vehicle's value)
const base = { u: 10, band: 1, trendMin: 8, det: "inhibit" as const, burst: BURST_NOTE };

export const PRESETS: Record<string, Mission> = {
  lunar: {
    ...base, id: "lunar", name: "Lunar surface mission", dest: "moon", route: ROUTES.lunar, volume: 9.3,
    blurb: "Launch, translunar coast in a capsule, then a lunar habitat at 34% O₂ / 8.2 psia and 0.166 g.",
    atm: { launch: { o2: 20.9, psia: 14.7 }, transit: { o2: 26.5, psia: 10.2 }, surface: { o2: 34, psia: 8.2 } },
    inv: [
      { label: "Nomex stowage bags", key: "nomex", exposed: true, stow: false },
      { label: "Silicone hatch seals", key: "silicone", exposed: true, stow: false },
      { label: "Acrylic window cover", key: "pmma", exposed: true, stow: false, t: 4, sides: "one" },
      { label: "Kapton wiring", key: "kapton", exposed: true, stow: false },
      { label: "Cotton crew clothing", key: "cotton_jersey", exposed: false, stow: true },
    ],
  },
  station: {
    ...base, id: "station", name: "Space station rotation", dest: "station", route: ROUTES.station, volume: 388,
    blurb: "Capsule to low Earth orbit, phasing, then docked to a station at sea-level air (20.9% O₂, 14.7 psia).",
    atm: { launch: { o2: 20.9, psia: 14.7 }, transit: { o2: 20.9, psia: 14.7 }, surface: { o2: 20.9, psia: 14.7 } },
    inv: [
      { label: "Nomex stowage bags", key: "nomex", exposed: true, stow: false },
      { label: "Acrylic panel", key: "pmma", exposed: true, stow: false, t: 4, sides: "one" },
      { label: "Kapton wiring", key: "kapton", exposed: true, stow: false },
      { label: "Cotton-fiberglass cloth", key: "sibal", exposed: true, stow: true },
      { label: "Cotton crew clothing", key: "cotton_jersey", exposed: false, stow: true },
    ],
  },
  gateway: {
    ...base, id: "gateway", name: "Lunar outpost (NRHO)", dest: "moon", route: ROUTES.gateway, volume: 9.3,
    blurb: "Translunar coast, then docked to a lunar-orbit outpost in microgravity at exploration air (26.5% O₂, 10.2 psia).",
    atm: { launch: { o2: 20.9, psia: 14.7 }, transit: { o2: 26.5, psia: 10.2 }, surface: { o2: 26.5, psia: 10.2 } },
    inv: [
      { label: "Nomex stowage bags", key: "nomex", exposed: true, stow: false },
      { label: "Silicone hatch seals", key: "silicone", exposed: true, stow: false },
      { label: "Acrylic window cover", key: "pmma", exposed: true, stow: false, t: 4, sides: "one" },
      { label: "Cotton-fiberglass cloth", key: "sibal", exposed: true, stow: true },
      { label: "Cotton crew clothing", key: "cotton_jersey", exposed: false, stow: true },
    ],
  },
  mars: {
    ...base, id: "mars", name: "Mars expedition", dest: "mars", route: ROUTES.mars, volume: 9.3,
    blurb: "Seven-month cruise at 26.5% O₂ / 10.2 psia, then a surface habitat at 30% O₂ and 0.38 g.",
    atm: { launch: { o2: 20.9, psia: 14.7 }, transit: { o2: 26.5, psia: 10.2 }, surface: { o2: 30, psia: 10.2 } },
    inv: [
      { label: "Nomex stowage bags", key: "nomex", exposed: true, stow: false },
      { label: "Silicone hatch seals", key: "silicone", exposed: true, stow: false },
      { label: "Acrylic window cover", key: "pmma", exposed: true, stow: false, t: 4, sides: "one" },
      { label: "Kapton wiring", key: "kapton", exposed: true, stow: false },
      { label: "Cotton crew clothing", key: "cotton_jersey", exposed: false, stow: true },
    ],
  },
};

const sstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export interface Vehicle { label: string; value: string; unit: string; vel: number; g: number }
const DIST: Record<Dest, number> = { moon: 384400, mars: 2.25e8, station: 0 };
const BODY: Record<Dest, string> = { moon: "Moon", mars: "Mars", station: "Station" };
/** Illustrative vehicle numbers (not a real vehicle). */
export function vehicle(m: Mission, met: number): Vehicle {
  const route = m.route, i = phaseIndex(route, met), p = route[i], x = phaseProgress(route, met), next = route[i + 1];
  switch (p.shape) {
    case "pad": return { label: "Altitude", value: "0", unit: "km", vel: 0, g: 1 };
    case "ascent": { const t = x * 510; return { label: "Altitude", value: (185 * Math.pow(sstep(x), 0.75)).toFixed(1), unit: "km", vel: 7.8 * Math.pow(x, 1.7), g: t < 150 ? 1.25 + (1.9 * t) / 150 : t < 156 ? 0.9 : 1 + (2 * (t - 156)) / 354 }; }
    case "orbit": return { label: "Altitude", value: "185", unit: "km", vel: 7.8, g: 0 };
    case "phasing": return { label: "Altitude", value: (185 + 235 * sstep(x)).toFixed(0), unit: "km", vel: 7.8 - 0.14 * x, g: 0 };
    case "docked": return { label: "Altitude", value: "420", unit: "km", vel: 7.66, g: 0 };
    case "transfer": {
      const d = (DIST[m.dest] * (1 - Math.exp(-3.2 * x))) / (1 - Math.exp(-3.2));
      return m.dest === "mars" ? { label: "From Earth", value: (d / 1e6).toFixed(0), unit: "M km", vel: Math.max(2.6, 11.6 * Math.exp(-1.5 * x)), g: 0 }
        : { label: "From Earth", value: Math.round(d / 1000) + "k", unit: "km", vel: Math.max(0.9, 10.8 * Math.exp(-2.6 * x)), g: 0 };
    }
    case "dorbit": { const lands = next?.shape === "surface", y = !lands || x < 0.8 ? 0 : sstep((x - 0.8) / 0.2), alt = m.dest === "mars" ? 400 : 100; return { label: `Above ${BODY[m.dest]}`, value: (alt * (1 - y)).toFixed(1), unit: "km", vel: (m.dest === "mars" ? 3.4 : 1.63) * (1 - y), g: x < 0.8 || !lands ? 0 : 0.3 }; }
    case "nrho": { const ph = ((met % 590000) / 590000) * Math.PI * 2; return { label: "Above Moon", value: Math.round(3000 + 32000 * (1 - Math.cos(ph))).toLocaleString("en"), unit: "km", vel: 0.1 + 1.6 * Math.pow((1 + Math.cos(ph)) / 2, 4), g: 0 }; }
    default: return { label: "Location", value: `${BODY[m.dest]} surface`, unit: "", vel: 0, g: p.gval };
  }
}
export { sstep };
