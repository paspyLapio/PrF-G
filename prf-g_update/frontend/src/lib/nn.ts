/**
 * Neural-network slot (P3's MLP plugs in here).
 * Firewall: the model's output is displayed as a second opinion only. Nothing in this module can change
 * status, alerts or options: the Simulation never imports it.
 *
 *   window.PrFG.connectMLP("MLP v1", (x) => ({ label: "Predicted spread", value: 0.31, unit: "mm/s" }))
 */
export interface NNInput { o2_pct: number; pressure_kpa: number; flow_cm_s: number; gravity_g: number; thickness_mm: number | null }
export interface NNOutput { label: string; value?: number; unit?: string; note?: string }
export type NNFn = (x: NNInput) => NNOutput;

let model: { name: string; fn: NNFn } | null = null;
const subs = new Set<() => void>();

export const nnModel = () => model;
export const onNN = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function connectMLP(name: string, fn: NNFn) { model = { name, fn }; subs.forEach((f) => f()); }
export function disconnectMLP() { model = null; subs.forEach((f) => f()); }
export function runNN(x: NNInput): NNOutput | { error: string } | null {
  if (!model) return null;
  try { return model.fn(x); } catch (e) { return { error: String(e) }; }
}

declare global { interface Window { PrFG: { connectMLP: typeof connectMLP; disconnectMLP: typeof disconnectMLP } } }
window.PrFG = { connectMLP, disconnectMLP };
