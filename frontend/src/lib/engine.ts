/**
 * Evidence engine: the same rules as the backend status logic (api/app/engine.py).
 * Every statement traces to a NASA run or to the Gaussian process fitted on 39 BASS-II segments.
 * Outside the evidence it says "untested" instead of estimating.
 */
import data from "../data/evidence.json";

export type Gravity = "1g" | "micro" | "partial";
export type Status = "STANDBY" | "NOMINAL" | "REDUCED" | "UNVERIFIED" | "LOW";
export type MatStateKind = "ok" | "near" | "unk" | "smoke";

export interface Run { inv: string; id: string; seg: number; fam: string; o2: number | null; p: number | null; u: number | null; out: string; sus: string; v: number | null; src: string | null }
export interface Material { key: string; name: string; cat: string; inv: string; ev: string }
export interface Band { p: string; a: number; b: number; i: string; c: string }
export interface Item { label: string; key: string; exposed: boolean; stow: boolean; t?: number; sides?: "one" | "two" }
export interface Cabin { o2: number; psia: number; u: number }
export interface DesignPoint { o2: number; psia: number }

export interface MatState { st: MatStateKind; lab: string; txt: string; why: string; runs: string[]; v?: number }
export interface Reason { k: string; t: string }
export interface Evaluation {
  status: Status; pct: number; head: number | null; weakest: { o2: number; label: string } | null;
  states: { item: Item; s: MatState }[]; burnable: number; covered: number; reasons: Reason[];
  spread: number | null; over: boolean; cabin: Cabin; g: Gravity;
  bandO2: Band; bandP: Band; bandU: Band;
}

const RUNS = data.runs as Run[];
export const MATS = data.mats as Material[];
const BANDS = data.bands as Band[];
const GP = data.gp as { mu: number[]; sd: number[]; Z: number[][]; alpha: number[]; Kinv: number[][]; c: number; ls: number[]; noise: number; ym: number; ys: number; err: number };
export const GP_ERR = GP.err;
export const KPA = 6.89476;
const DOM = { te: [0.5, 5], o2: [17, 22.5], u: [2, 21], p: [97, 103] } as const;
export const FAM: Record<string, string> = {
  sibal: "sibal_fabric", cotton_jersey: "cotton_fabric", pmma: "pmma", pmma_structured: "pmma_structured", nomex: "nomex_fabric",
  silicone: "silicone", nomex_ht90_40: "nomex_ht90_fabric", ultem_1000: "ultem_film", mylar_g: "mylar_film",
};
const f1 = (x: number) => x.toFixed(1);
export const material = (k: string) => MATS.find((m) => m.key === k);
const runsOf = (fam: string) => RUNS.filter((r) => r.fam === fam);
export const runId = (r: Run) => `${r.inv}:${r.id}${r.seg > 1 ? "-s" + r.seg : ""}`;

export function bandOf(param: string, v: number): Band {
  return BANDS.find((b) => b.p === param && v >= b.a && v < b.b) ?? BANDS.filter((b) => b.p === param).slice(-1)[0];
}

export function gpPredict(te: number, o2: number): { mu: number; sd: number } {
  const z = [(Math.log(te) - GP.mu[0]) / GP.sd[0], (o2 - GP.mu[1]) / GP.sd[1]];
  const k = GP.Z.map((r) => GP.c * Math.exp(-0.5 * (((r[0] - z[0]) / GP.ls[0]) ** 2 + ((r[1] - z[1]) / GP.ls[1]) ** 2)));
  let m = 0, q = 0;
  for (let i = 0; i < k.length; i++) {
    m += k[i] * GP.alpha[i];
    let s = 0;
    for (let j = 0; j < k.length; j++) s += GP.Kinv[i][j] * k[j];
    q += k[i] * s;
  }
  return { mu: GP.ym + GP.ys * m, sd: Math.sqrt(Math.max(0, GP.c - q + GP.noise)) * GP.ys };
}

export function outsideDomain(te: number, o2: number, u: number, pk: number): string[] {
  const w: string[] = [];
  if (te < DOM.te[0] || te > DOM.te[1]) w.push("thickness");
  if (o2 < DOM.o2[0] || o2 > DOM.o2[1]) w.push("oxygen");
  if (u < DOM.u[0] || u > DOM.u[1]) w.push("airflow");
  if (pk < DOM.p[0] || pk > DOM.p[1]) w.push("pressure");
  return w;
}

function nearest(fam: string, o2: number, pk: number, u: number) {
  return runsOf(fam).filter((r) => r.o2 != null)
    .map((r) => ({ r, d: Math.hypot((r.o2! - o2) / 3, ((r.u ?? u) - u) / 10, r.p != null ? (r.p - pk) / 20 : 0.5) }))
    .sort((a, b) => a.d - b.d)[0];
}

export function ceiling(fam: string): Run | null {
  const rs = runsOf(fam).filter((r) => r.o2 != null && r.sus !== "");
  return rs.length ? rs.reduce((a, b) => (b.o2! > a.o2! ? b : a)) : null;
}

export function materialState(it: Item, o2: number, pk: number, u: number, g: Gravity): MatState {
  const m = material(it.key), fam = FAM[it.key];
  if (!m) return { st: "unk", lab: "Unknown", txt: "", why: "", runs: [] };
  if (m.cat === "B") return { st: "smoke", lab: "Smoke data only", txt: m.ev, why: `${m.name} was heated in SAME / SAME-R to study its smoke, not burned. Not counted as burnable evidence.`, runs: [] };
  if (m.cat === "C") return { st: "unk", lab: "No microgravity test", txt: "Used on spacecraft; no microgravity burn or smoke test found", why: "No NASA microgravity fire test for this material in the evidence base.", runs: [] };
  if (fam === "pmma" && g === "micro" && it.t) {
    const te = it.sides === "two" ? it.t / 2 : it.t;
    if (!outsideDomain(te, o2, u, pk).length) {
      const v = Math.exp(gpPredict(te, o2).mu);
      return { st: "ok", lab: "Model-supported", v, txt: `predicted spread ${v.toFixed(3)} mm/s`, why: `Gaussian process on 39 BASS-II segments from 18 PMMA tests (NASA/TM-20210011385, Table 5.1); held-out typical error ×${GP.err.toFixed(2)}.`, runs: [] };
    }
  }
  if (it.key === "nomex") {
    const ids = runsOf(fam).map(runId);
    if (g === "micro" && o2 <= 23) return { st: "near", lab: "Flight data", txt: "No sustained flame in 3 of 3 BASS-II tests at station-air oxygen", why: "BASS-II F1–F3 (NASA/TM-20210011385, Section 3.1).", runs: ids };
    return { st: "unk", lab: "Untested here", txt: "No flame in BASS-II, but only at station-air oxygen or lower", why: `BASS-II F1–F3 ran at station-air oxygen or lower; nothing is known at ${f1(o2)}% O₂${g !== "micro" ? " or outside microgravity" : ""}.`, runs: ids };
  }
  if (!fam) return { st: "unk", lab: "Untested here", txt: "Burned in microgravity; run values not transcribed", why: m.inv ? `Reported in ${m.inv}.` : "", runs: [] };
  const n = nearest(fam, o2, pk, u);
  if (n && n.d <= 1.2 && g === "micro") return { st: "near", lab: "Flight data", txt: `nearest NASA run ${n.r.inv} ${n.r.id}: ${n.r.v != null ? "spread " + n.r.v + " mm/s" : n.r.out}`, why: "A NASA run sits close to these conditions; shown as data, not a prediction.", runs: [runId(n.r)] };
  const c = ceiling(fam);
  return {
    st: "unk", lab: "Untested here", txt: c ? `NASA evidence only up to ${f1(c.o2!)}% O₂` : "no transcribed conditions",
    why: (g !== "micro" ? "NASA PSI has no partial-gravity fire data; microgravity results act only as a bound. " : "Outside the tested conditions. ") + (c ? `Highest O₂ with a result: ${runId(c)}.` : ""),
    runs: c ? [runId(c)] : [],
  };
}

export const STATUS_ORDER: Status[] = ["STANDBY", "NOMINAL", "REDUCED", "UNVERIFIED", "LOW"];
export const ALERT: Record<Status, "ADVISORY" | "CAUTION" | null> = { STANDBY: null, NOMINAL: null, REDUCED: "ADVISORY", UNVERIFIED: "ADVISORY", LOW: "CAUTION" };

export function evaluate(inv: Item[], cabin: Cabin, design: DesignPoint, g: Gravity, band: number): Evaluation {
  const { o2, psia, u } = cabin, pk = psia * KPA;
  const states = inv.filter((i) => i.exposed).map((item) => ({ item, s: materialState(item, o2, pk, u, g) }));
  const burn = states.filter((x) => x.s.st !== "smoke");
  const cov = burn.filter((x) => x.s.st === "ok" || x.s.st === "near");
  const pct = burn.length ? Math.round((100 * cov.length) / burn.length) : 100;
  const ceilings = burn.filter((x) => x.item.key !== "nomex" && FAM[x.item.key]).map((x) => ({ c: ceiling(FAM[x.item.key]), label: x.item.label })).filter((x) => x.c);
  const weak = ceilings.length ? ceilings.reduce((a, b) => (b.c!.o2! < a.c!.o2! ? b : a)) : null;
  const head = weak ? weak.c!.o2! - o2 : null;
  const bandO2 = bandOf("o2_pct", o2), bandU = bandOf("airflow_cms", u), bandP = bandOf("pressure_psia", psia);
  const lvl = ({ reference: 0, check_design: 0, elevated: 1, high: 2, outside_reference: 3 } as Record<string, number>)[bandO2.c] ?? 1;
  const over = o2 > design.o2 + band;
  const reasons: Reason[] = [];
  let status: Status;
  if (g === "1g") {
    status = "STANDBY";
    reasons.push({ k: "1g", t: "Launch phase: cabin materials are covered by NASA-STD-6001 ground tests. Screening starts in orbit." });
  } else {
    if (lvl >= 3 || (over && pct < 50)) status = "LOW";
    else if (burn.length && pct === 0) status = "UNVERIFIED";
    else if (pct < 100 || lvl >= 2 || (head != null && head < 0) || bandU.c === "sensitive") status = "REDUCED";
    else status = "NOMINAL";
    if (over) reasons.push({ k: "o2", t: `Oxygen is ${f1(o2 - design.o2)} points above the ${design.o2}% design point.` });
    const unc = burn.filter((x) => !(x.s.st === "ok" || x.s.st === "near"));
    if (unc.length) reasons.push({ k: "cov", t: `${unc.length} of ${burn.length} exposed materials have no NASA test evidence here.` });
    if (head != null && head < 0) reasons.push({ k: "head", t: -head < 0.05 ? `Cabin O₂ has reached the highest tested O₂ for ${weak!.label} (${f1(weak!.c!.o2!)}%).` : `Cabin O₂ is ${f1(-head)} points above the highest tested O₂ for ${weak!.label}.` });
    if (bandU.c === "sensitive") reasons.push({ k: "u", t: `Airflow ${f1(u)} cm/s: the range where BASS-II flames were most flow-sensitive.` });
    if (g === "partial") reasons.push({ k: "g", t: "No partial-gravity fire data exists in NASA PSI." });
    if (!reasons.length) reasons.push({ k: "ok", t: "Every exposed material has NASA test evidence at these conditions." });
  }
  const pm = states.find((x) => x.s.st === "ok");
  return {
    status, pct, head, weakest: weak ? { o2: weak.c!.o2!, label: weak.label } : null, states, burnable: burn.length, covered: cov.length,
    reasons, spread: pm?.s.v ?? null, over, cabin, g, bandO2, bandP, bandU,
  };
}
