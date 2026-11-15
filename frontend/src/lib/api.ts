/**
 * Live connection to the PrF-G FastAPI backend (api/). The base URL comes from VITE_API_URL at build time.
 * If the API is missing or unreachable, the app keeps working on its built-in copy of the same engine.
 */
import type { Cabin, Gravity, Item, Status } from "./engine";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface BackendView {
  status: Status; pct: number; head: number | null; weakest: string | null; reasons: string[];
  materials: { key: string; state: string; detail: string; runs: string[] }[]; spread: number | null;
}
interface IndexResponse {
  status: string; coverage_pct: number; o2_headroom_pts: number | null; weakest_material: string | null; reasons: string[];
  per_material: { material: string; state: string; detail: string; evidence_run_ids: string[] }[];
  predicted_spread: { spread_mm_s: number } | null;
}

const gravityG = (g: Gravity) => (g === "micro" ? 0 : g === "lunar" ? 0.166 : 1);

function params(cabin: Cabin, design: number, g: Gravity, inv: Item[]) {
  const exposed = inv.filter((i) => i.exposed);
  const pmma = exposed.find((i) => i.key === "pmma");
  const q = new URLSearchParams({
    o2_pct: cabin.o2.toFixed(2), pressure_psi: cabin.psia.toFixed(3), flow_cm_s: cabin.u.toFixed(2), gravity_g: String(gravityG(g)),
    design_o2_pct: String(design), materials: exposed.map((i) => i.key).join(","),
  });
  if (pmma?.t) { q.set("pmma_thickness_mm", String(pmma.t)); q.set("pmma_sides", pmma.sides ?? "one"); }
  return q;
}

export async function fetchStatus(cabin: Cabin, design: number, g: Gravity, inv: Item[], signal?: AbortSignal): Promise<BackendView> {
  const r = await fetch(`${API_URL}/index?${params(cabin, design, g, inv)}`, { signal });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const d = (await r.json()) as IndexResponse;
  return {
    status: d.status.toUpperCase() as Status, pct: d.coverage_pct, head: d.o2_headroom_pts, weakest: d.weakest_material, reasons: d.reasons,
    materials: d.per_material.map((m) => ({ key: m.material, state: m.state, detail: m.detail, runs: m.evidence_run_ids })),
    spread: d.predicted_spread?.spread_mm_s ?? null,
  };
}

export async function ask(question: string, cabin: Cabin, design: number, g: Gravity, inv: Item[]): Promise<{ answer: string; runs: string[] }> {
  const exposed = inv.filter((i) => i.exposed);
  const r = await fetch(`${API_URL}/ask`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, current: { o2_pct: cabin.o2, pressure_psi: cabin.psia, flow_cm_s: cabin.u, gravity_g: gravityG(g), design_o2_pct: design, materials: exposed.map((i) => i.key) } }),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const d = (await r.json()) as { answer: string; cited_run_ids: string[] };
  return { answer: d.answer, runs: d.cited_run_ids ?? [] };
}

/** P3's neural network (GET /mlp): a second opinion, read only by the dashboard's Neural network tab. */
export interface MLPRow { material: string; family: string | null; training_rows?: number; scores: Record<string, number> | null; predicted: string | null; in_domain: boolean; issues: string[] }
export interface MLPResult { model: string; per_material: MLPRow[]; firewall: string; note: string }
export async function fetchMLP(cabin: Cabin, g: Gravity, inv: Item[], signal?: AbortSignal): Promise<MLPResult> {
  const r = await fetch(`${API_URL}/mlp?${params(cabin, 0, g, inv)}`, { signal });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return (await r.json()) as MLPResult;
}
