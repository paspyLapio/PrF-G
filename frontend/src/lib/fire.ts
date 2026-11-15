/**
 * Fire-consequence model: what happens if a caution is left unresolved and an ignition source appears.
 * Demo only. PrF-G itself never detects or fights fires; in the simulation the vehicle's own smoke detectors
 * and caution & warning system take over (fire_event hand-off).
 *
 * Every limit comes from a NASA document; the coupling physics uses standard engineering references.
 * Nothing here feeds back into the evidence status, alerts or crew options.
 */
import { FAM, material, type Item, type MatState } from "./engine";
import data from "../data/evidence.json";

/** NASA limits used to judge the outcome. */
export const LIMITS = {
  /** JSC 20584 Rev C, Spacecraft Maximum Allowable Concentrations: CO 425 ppm (485 mg/m³) for 1 h, 100 ppm (114 mg/m³) for 24 h. */
  co1h: 485, co24h: 114,
  /** NASA-STD-3001 Vol. 2 [V2 6006]: total pressure for indefinite crew exposure 5.0–15.0 psia. */
  pMax: 15.0,
  /** Apollo 204 Review Board: fire reported 23:31:04.7 GMT, cabin ruptured ~23:31:19 at "at least 29 psia". */
  apolloBurst: 29,
};

/** Engineering references (not NASA). */
export const REF = {
  /** NFPA 72 Annex B t-squared fire growth: Q = α t², α in kW/s² (time to 1055 kW: 600 / 300 / 150 s). */
  alpha: { slow: 0.00293, medium: 0.01172, fast: 0.0469 } as const,
  /** Ratio of specific heats for air. Closed-cabin pressure rise ΔP = (γ − 1)·E / V (adiabatic, no venting). */
  gamma: 1.4,
  /** SFPE Handbook (Tewarson), PMMA: effective heat of combustion 24.2 MJ/kg, CO yield 0.010 g/g. Used for every material. */
  dHc: 24200, yCO: 0.010,
  /** Demo assumptions, shown on the loss report: detector alarm delay (armed / inhibited) and suppression decay. */
  detectArmed: 20, detectInhibited: 60, suppressTau: 8,
};

export type Growth = keyof typeof REF.alpha;
export type FireStage = "burning" | "detected" | "suppressed" | "out" | "lost" | "selfext";
export interface FireSample { t: number; q: number; psia: number; co: number }
export interface Fire {
  stage: FireStage; t: number; met0: number; item: Item; name: string; growth: Growth; regime: string;
  spread: { v: number | null; run: string | null }; q: number; e: number; p0: number; dp: number; co: number;
  detectAt: number; detectedAt: number | null; responseAt: number | null; endedAt: number | null;
  cause: "pressure" | "co" | null; burst: number; volume: number; inhibited: boolean; history: FireSample[];
}

const RUNS = data.runs as { inv: string; id: string; seg: number; fam: string; o2: number | null; v: number | null; sus: string }[];
/** Fastest NASA-measured flame spread for a material family (microgravity). */
export function nasaSpread(key: string) {
  const fam = FAM[key]; if (!fam) return { v: null, run: null };
  const rs = RUNS.filter((r) => r.fam === fam && r.v != null);
  if (!rs.length) return { v: null, run: null };
  const r = rs.reduce((a, b) => (b.v! > a.v! ? b : a));
  return { v: r.v, run: `${r.inv}:${r.id}${r.seg > 1 ? "-s" + r.seg : ""} at ${r.o2 ?? "?"}% O₂` };
}

/** NASA evidence that this material did not sustain a flame at these conditions. */
const noSustain = (s: MatState) => (s.st === "near" || s.st === "ok") && /no.?sustained/i.test(s.txt);

/** Pick what ignites: an exposed burnable material outside NASA evidence, preferring one with spread data. */
export function pickItem(states: { item: Item; s: MatState }[]) {
  const burn = states.filter((x) => x.s.st !== "smoke");
  const unk = burn.filter((x) => x.s.st === "unk");
  const pool = unk.length ? unk : burn;
  return pool.find((x) => nasaSpread(x.item.key).v != null) ?? pool[0] ?? null;
}

/** Growth class from the evidence (a PrF-G assumption, shown on the report). */
export function growthFor(s: MatState, low: boolean): { growth: Growth; regime: string } | null {
  if (noSustain(s)) return null;
  if (s.st === "ok" || s.st === "near") return { growth: "slow", regime: "inside NASA-tested conditions" };
  return low ? { growth: "fast", regime: "outside tested conditions and above the caution point" } : { growth: "medium", regime: "outside NASA-tested conditions" };
}

export function ignite(item: Item, s: MatState, low: boolean, met: number, psia: number, volume: number, burst: number, inhibited: boolean): Fire {
  const g = growthFor(s, low);
  const base: Fire = {
    stage: g ? "burning" : "selfext", t: 0, met0: met, item, name: material(item.key)?.name ?? item.key, growth: g?.growth ?? "slow",
    regime: g?.regime ?? "NASA tests show no sustained flame at these conditions", spread: nasaSpread(item.key),
    q: 0, e: 0, p0: psia, dp: 0, co: 0, detectAt: inhibited ? REF.detectInhibited : REF.detectArmed, detectedAt: null,
    responseAt: null, endedAt: g ? null : 0, cause: null, burst, volume, inhibited, history: [],
  };
  return base;
}

const PA_PER_PSI = 6894.76;
/** Advance the fire by dt seconds of real time. Returns the cabin pressure rise (psi) caused so far. */
export function stepFire(f: Fire, dt: number) {
  if (f.stage === "lost" || f.stage === "out" || f.stage === "selfext") return;
  f.t += dt;
  if (f.stage === "suppressed") f.q *= Math.exp(-dt / REF.suppressTau);
  else f.q = REF.alpha[f.growth] * f.t * f.t;
  f.e += f.q * dt; // kJ
  f.dp = ((REF.gamma - 1) * f.e * 1000) / f.volume / PA_PER_PSI;
  const burnedKg = f.e / REF.dHc;
  f.co = (REF.yCO * burnedKg * 1e6) / f.volume; // mg/m³
  if (f.stage === "burning" && f.t >= f.detectAt) { f.stage = "detected"; f.detectedAt = f.t; }
  if (f.stage === "suppressed" && f.q < 1) { f.stage = "out"; f.endedAt = f.t; }
  if (f.p0 + f.dp >= f.burst) { f.stage = "lost"; f.cause = "pressure"; f.endedAt = f.t; }
  else if (f.co >= LIMITS.co1h) { f.stage = "lost"; f.cause = "co"; f.endedAt = f.t; }
  const last = f.history[f.history.length - 1];
  if (!last || f.t - last.t >= 0.5) f.history.push({ t: f.t, q: f.q, psia: f.p0 + f.dp, co: f.co });
}

export function respond(f: Fire) { if (f.stage === "detected") { f.stage = "suppressed"; f.responseAt = f.t; } }

/** Seconds until the structural limit at the current growth (for the banner), or null. */
export function timeToBurst(f: Fire) {
  if (f.stage !== "burning" && f.stage !== "detected") return null;
  const a = REF.alpha[f.growth], need = ((f.burst - f.p0) * PA_PER_PSI * f.volume) / ((REF.gamma - 1) * 1000); // kJ
  const tB = Math.cbrt((3 * need) / a); // E = α t³ / 3
  return Math.max(0, tB - f.t);
}
