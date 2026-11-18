/**
 * P3's neural network running fully in the browser (port of api/app/mlp_overlay.py).
 * Weights are plain JSON (src/data/mlp.json, generated from api/data/mlp). No backend needed.
 * Firewall: display only. Nothing here can change status, alerts or options.
 */
import data from "../data/mlp.json";
import type { MLPResult, MLPRow } from "./api";

const KPA_PER_PSI = 6.89476;
const NUMERIC = ["thickness_mm", "heated_thickness_mm", "width_cm", "burning_sides", "areal_density_kg_m2",
  "o2_initial_pct", "pressure_kpa", "pressure_series_range_kpa", "flow_cms", "gravity"];
const CATEGORICAL = ["material", "material_family", "geometry_class", "o2_basis", "pressure_source", "flow_config"];
const FAMILY: Record<string, string> = {
  sibal: "sibal_fabric", cotton_jersey: "cotton_fabric", cotton_fabric: "cotton_fabric", pmma: "pmma",
  pmma_structured: "pmma_structured", nomex: "nomex_fabric", nomex_fabric: "nomex_fabric", silicone: "silicone",
  nomex_ht90_40: "nomex_ht90_fabric", ultem_1000: "ultem_film", mylar_g: "mylar_film",
};
const CONSTANT_IN_TRAINING: Record<string, number> = { burning_sides: 0, pressure_series_range_kpa: 0, gravity: 0 };

type Rec = Record<string, number | string | null | undefined>;
const pre = data.pre as {
  numeric_medians: Record<string, number>; numeric_means: Record<string, number>; numeric_stds: Record<string, number>;
  numeric_min: Record<string, number>; numeric_max: Record<string, number>; category_columns: string[];
};
const templates = data.templates as Record<string, Rec>;
const classes = data.classes as string[];

function vector(rec: Rec): number[] {
  const num = NUMERIC.map((c) => {
    const raw = rec[c];
    const v = raw == null ? pre.numeric_medians[c] : Number(raw);
    return (v - pre.numeric_means[c]) / pre.numeric_stds[c];
  });
  const active = new Set(CATEGORICAL.map((c) => `${c}_${rec[c] != null ? rec[c] : "UNKNOWN"}`));
  return [...num, ...pre.category_columns.map((col) => (active.has(col) ? 1 : 0))];
}

function forward(x: number[]): number[] {
  const { W1, b1, W2, b2 } = data;
  const h = b1.map((b, j) => {
    let s = b;
    for (let i = 0; i < x.length; i++) s += x[i] * W1[i][j];
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, s))));
  });
  const z = b2.map((b, k) => { let s = b; for (let j = 0; j < h.length; j++) s += h[j] * W2[j][k]; return s; });
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
}

function domain(rec: Rec, gravity: number): string[] {
  const issues: string[] = [];
  for (const c of ["o2_initial_pct", "pressure_kpa", "flow_cms", "thickness_mm", "heated_thickness_mm"]) {
    if (rec[c] == null) continue;
    const v = Number(rec[c]), z = (v - pre.numeric_means[c]) / pre.numeric_stds[c];
    const lo = pre.numeric_min[c], hi = pre.numeric_max[c];
    if (Math.abs(z) > 3 || !(lo <= v && v <= hi)) issues.push(`${c} = ${+v.toPrecision(6)} is outside the training range ${lo}–${hi}`);
  }
  if (gravity > 0.01) issues.push("trained on microgravity tests only; no partial- or 1 g training data");
  return issues;
}

export function assessLocal(o2: number, psi: number, flow: number, gravity: number, materials: string[],
  pmmaT?: number | null, pmmaSides: "one" | "two" = "one"): MLPResult {
  const per: MLPRow[] = materials.map((key) => {
    const fam = FAMILY[key] ?? key, t = templates[fam];
    if (!t) return { material: key, family: null, in_domain: false, scores: null, predicted: null, untested: true, issues: ["no training data for this material"] };
    const rec: Rec = { ...t, ...CONSTANT_IN_TRAINING, o2_initial_pct: o2, pressure_kpa: psi * KPA_PER_PSI, flow_cms: flow };
    if (fam === "pmma" && pmmaT) { rec.thickness_mm = pmmaT; rec.heated_thickness_mm = pmmaSides === "two" ? pmmaT / 2 : pmmaT; }
    const issues = domain(rec, gravity), rows = t.n_training_rows as number;
    if (issues.length) return { material: key, family: fam, training_rows: rows, scores: null, predicted: null, in_domain: false, untested: true, issues };
    const p = forward(vector(rec));
    const scores: Record<string, number> = {};
    classes.forEach((c, i) => (scores[c] = Math.round(p[i] * 1000) / 1000));
    return { material: key, family: fam, training_rows: rows, scores, predicted: classes[p.indexOf(Math.max(...p))], in_domain: true, untested: false, issues: [] };
  });
  return {
    model: "P3 MLP: sustained burning yes/no (16 hidden units, trained on NASA runs, grouped CV)",
    per_material: per,
    firewall: "Second opinion only. Never changes status, alerts or crew options.",
    note: "Scores are uncalibrated softmax outputs, not fire probabilities. Outside the training domain no score is shown (untested).",
  };
}
