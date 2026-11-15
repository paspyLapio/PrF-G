/**
 * O₂ trend projection (team Task 2).
 * Linear least squares over the readings from the last `windowMin` *simulated* minutes (timestamps, not a sample count):
 *   O₂(t) = a + b·t, t in minutes relative to now, so a is the fitted current O₂ and b the slope in points/min.
 * Two separate targets, never merged:
 *   - caution point: design O₂ + allowed band (a project setting, not a NASA limit)
 *   - tested-evidence edge: highest O₂ with a NASA result for the weakest exposed material (not a fire threshold)
 * "Already reached" if the fitted value or the latest reading is at or above the target, so it never contradicts the status.
 * Time to target = (T − a) / b, only when b > 0 is significant and T > a. Otherwise "already reached" or "no upward crossing".
 * Too few, stale or too noisy readings → "projection unavailable" instead of an invented ETA.
 */
export type TargetState = "eta" | "reached" | "none";
export interface Target { label: string; o2: number; state: TargetState; min?: number }
export type TrendDir = "rising" | "falling" | "steady";
export interface Projection {
  ok: boolean; reason?: string; window: number; n: number;
  a?: number; b?: number; dir?: TrendDir; caution: Target; edge: Target | null;
}

export const MIN_READINGS = 5;
const STALE_S = 60; // newest reading older than 1 simulated minute → stale
const STEADY = 0.02; // points/min

function target(label: string, o2: number, a: number | undefined, b: number | undefined, dir: TrendDir | undefined, cur?: number): Target {
  if (a == null || b == null) return { label, o2, state: "none" };
  if (a >= o2 || (cur != null && cur >= o2)) return { label, o2, state: "reached" };
  if (dir !== "rising") return { label, o2, state: "none" };
  return { label, o2, state: "eta", min: (o2 - a) / b };
}

export function project(hist: [number, number][], now: number, windowMin: number, caution: { label: string; o2: number }, edge: { label: string; o2: number } | null, current?: number): Projection {
  const pts = hist.filter(([t]) => t >= now - windowMin * 60 && t <= now);
  const base = { window: windowMin, n: pts.length };
  const none = (reason: string): Projection => ({ ...base, ok: false, reason, caution: { ...caution, state: "none" }, edge: edge && { ...edge, state: "none" } });
  if (pts.length < MIN_READINGS) return none(`Fewer than ${MIN_READINGS} readings in the last ${windowMin} min`);
  if (now - pts[pts.length - 1][0] > STALE_S) return none("Telemetry is stale");
  const span = (pts[pts.length - 1][0] - pts[0][0]) / 60;
  if (span < windowMin * 0.5) return none(`Readings cover only ${span.toFixed(1)} of ${windowMin} min`);

  const xs = pts.map(([t]) => (t - now) / 60), ys = pts.map(([, y]) => y), n = pts.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const b = sxy / sxx, a = my - b * mx;
  let rss = 0; for (let i = 0; i < n; i++) rss += (ys[i] - (a + b * xs[i])) ** 2;
  const seB = Math.sqrt(rss / Math.max(1, n - 2) / sxx);
  // a slope smaller than twice its standard error is noise, not a trend
  const dir: TrendDir = Math.abs(b) < STEADY || Math.abs(b) < 2 * seB ? "steady" : b > 0 ? "rising" : "falling";
  return { ...base, ok: true, a, b, dir, caution: target(caution.label, caution.o2, a, b, dir, current), edge: edge && target(edge.label, edge.o2, a, b, dir, current) };
}

export function fmtEta(t: Target): string {
  if (t.state === "reached") return "Already reached";
  if (t.state === "none" || t.min == null) return "No upward crossing projected";
  return t.min < 1 ? `≈ ${Math.max(1, Math.round(t.min * 60))} s` : `≈ ${t.min < 60 ? t.min.toFixed(1) : Math.round(t.min)} min`;
}
