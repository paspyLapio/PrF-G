import type { DesignPoint, Gravity, Item } from "./engine";

export type AtmKey = "launch" | "transit" | "surface";
export interface Phase { id: string; name: string; real: number; demo: number; g: Gravity; atm: AtmKey; caption: string }
export interface Mission { name: string; u: number; band: number; trendMin: number; det: "inhibit" | "always"; atm: Record<AtmKey, DesignPoint>; inv: Item[] }

/** Demo timing: about 90 s from T-1 min to the surface caution at 1x. Real durations drive the clock. */
export const PHASES: Phase[] = [
  { id: "pad", name: "Pre-launch", real: 60, demo: 4, g: "1g", atm: "launch", caption: "Crew strapped in. PrF-G on standby: launch materials are covered by 1 g ground certification." },
  { id: "ascent", name: "Ascent", real: 510, demo: 14, g: "1g", atm: "launch", caption: "Liftoff. PrF-G stays on standby under launch loads." },
  { id: "leo", name: "Earth orbit", real: 7200, demo: 7, g: "micro", atm: "launch", caption: "Microgravity. Screening starts: every exposed material has NASA test evidence." },
  { id: "tli", name: "Translunar", real: 259200, demo: 14, g: "micro", atm: "transit", caption: "Cabin moves to exploration air (10.2 psia). Some materials leave NASA's tested range." },
  { id: "llo", name: "Lunar orbit", real: 86400, demo: 7, g: "micro", atm: "transit", caption: "Lunar orbit, then powered descent." },
  { id: "surf", name: "Surface", real: Infinity, demo: Infinity, g: "lunar", atm: "surface", caption: "Habitat at 34% O₂, 8.2 psia, 0.166 g. NASA has no partial-gravity fire data, and PrF-G says so." },
];
export const SURFACE_RATE = 60; // 1 simulated minute per second on the surface
export const START_MET = -60;
export const PHASE_START: number[] = (() => { let t = START_MET; return PHASES.map((p) => { const s = t; t += p.real; return s; }); })();

export const phaseIndex = (met: number) => { let i = 0; PHASE_START.forEach((s, k) => { if (met >= s) i = k; }); return i; };
export const phaseProgress = (met: number) => {
  const i = phaseIndex(met), p = PHASES[i];
  return p.real === Infinity ? Math.min(1, (met - PHASE_START[i]) / 1800) : Math.min(1, Math.max(0, (met - PHASE_START[i]) / p.real));
};

export const PRESETS: Record<string, Mission & { blurb: string }> = {
  lunar: {
    name: "Lunar surface mission", blurb: "Launch, translunar coast and a lunar habitat at 34% O₂ / 8.2 psia.", u: 10, band: 1, trendMin: 8, det: "inhibit",
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
    name: "Orbital station rotation", blurb: "Same flight to orbit, then station-like air (21% O₂, 14.5 psia) throughout.", u: 10, band: 1, trendMin: 8, det: "inhibit",
    atm: { launch: { o2: 20.9, psia: 14.7 }, transit: { o2: 21, psia: 14.5 }, surface: { o2: 21, psia: 14.5 } },
    inv: [
      { label: "Nomex stowage bags", key: "nomex", exposed: true, stow: false },
      { label: "Acrylic panel", key: "pmma", exposed: true, stow: false, t: 4, sides: "one" },
      { label: "Kapton wiring", key: "kapton", exposed: true, stow: false },
      { label: "Cotton-fiberglass cloth", key: "sibal", exposed: true, stow: true },
      { label: "Cotton crew clothing", key: "cotton_jersey", exposed: false, stow: true },
    ],
  },
};

const sstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export interface Vehicle { label: string; value: string; unit: string; vel: number; g: number }
/** Illustrative vehicle numbers (not a real vehicle). */
export function vehicle(met: number): Vehicle {
  const id = PHASES[phaseIndex(met)].id, x = phaseProgress(met);
  if (id === "pad") return { label: "Altitude", value: "0", unit: "km", vel: 0, g: 1 };
  if (id === "ascent") { const t = x * 510; return { label: "Altitude", value: (185 * Math.pow(sstep(x), 0.75)).toFixed(1), unit: "km", vel: 7.8 * Math.pow(x, 1.7), g: t < 150 ? 1.25 + (1.9 * t) / 150 : t < 156 ? 0.9 : 1 + (2 * (t - 156)) / 354 }; }
  if (id === "leo") return { label: "Altitude", value: "185", unit: "km", vel: 7.8, g: 0 };
  if (id === "tli") { const d = (384400 * (1 - Math.exp(-3.2 * x))) / (1 - Math.exp(-3.2)); return { label: "From Earth", value: Math.round(d / 1000) + "k", unit: "km", vel: Math.max(0.9, 10.8 * Math.exp(-2.6 * x)), g: 0 }; }
  if (id === "llo") { const y = x < 0.8 ? 0 : sstep((x - 0.8) / 0.2); return { label: "Above Moon", value: (100 * (1 - y)).toFixed(1), unit: "km", vel: 1.63 * (1 - y), g: x < 0.8 ? 0 : 0.3 }; }
  return { label: "Location", value: "Surface", unit: "", vel: 0, g: 0.166 };
}
export { sstep };
