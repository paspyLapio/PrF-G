import { useMemo, useState } from "react";
import { MATS, evaluate, type Item } from "../lib/engine";
import { PRESETS, type AtmKey, type Mission } from "../lib/mission";
import { SC, f1 } from "../lib/ui";

const clone = (m: Mission): Mission => structuredClone({ name: m.name, u: m.u, band: m.band, trendMin: m.trendMin, det: m.det, atm: m.atm, inv: m.inv });
const CHECKS: { label: string; atm: AtmKey; g: "micro" | "lunar" }[] = [
  { label: "Earth orbit", atm: "launch", g: "micro" }, { label: "Translunar", atm: "transit", g: "micro" }, { label: "Surface", atm: "surface", g: "lunar" },
];

export function Launch({ onLaunch }: { onLaunch: (m: Mission) => void }) {
  const [preset, setPreset] = useState("lunar");
  const [m, setM] = useState<Mission>(() => clone(PRESETS.lunar));
  const pick = (k: string) => { setPreset(k); setM(clone(PRESETS[k])); };
  const set = (f: (d: Mission) => void) => setM((p) => { const d = structuredClone(p); f(d); return d; });
  const setItem = (i: number, f: (it: Item) => void) => set((d) => f(d.inv[i]));

  const pre = useMemo(() => CHECKS.map((c) => {
    const d = m.atm[c.atm], e = evaluate(m.inv, { o2: d.o2, psia: d.psia, u: m.u }, d, c.g, m.band);
    return { ...c, e, d };
  }), [m]);

  return (
    <div className="intro">
      <div className="icard">
        <div>
          <div className="eyebrow">NASA Space Apps 2026 · Flame in Freefall</div>
          <h1>PrF-G</h1>
          <p className="tagline">Prevent Fire-Guard. An onboard advisor that reads the telemetry the spacecraft already has and tells the crew, before anything burns, whether NASA has ever tested their cabin at these conditions.</p>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>1 · Mission</div>
          <div className="presets">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} className="preset" aria-pressed={preset === k} onClick={() => pick(k)}><b>{p.name}</b><span>{p.blurb}</span></button>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>2 · Pre-flight check at design conditions</div>
          <div className="preflight">
            {pre.map(({ label, e, d }) => (
              <div className="pfc" key={label} style={{ ["--c" as string]: SC[e.status] }}>
                <div className="eyebrow">{label} · {f1(d.o2)}% / {d.psia} psia</div>
                <div className="w">{e.status}</div>
                <div className="x">{e.covered} of {e.burnable} materials covered{e.head != null ? ` · headroom ${e.head >= 0 ? "+" : "−"}${f1(Math.abs(e.head))} pts` : ""}</div>
              </div>
            ))}
          </div>
        </div>

        <details className="adv">
          <summary>Configure this vehicle: atmosphere, airflow and cabin materials ›</summary>
          <p className="muted" style={{ fontSize: 12.5 }}>Inputs only. Every vehicle is different; PrF-G screens whatever is entered against NASA evidence and does not recommend set points.</p>
          <div className="advgrid">
            <div>
              <div className="tw"><table className="tbl">
                <thead><tr><th>Design point</th><th>O₂ %</th><th>psia</th></tr></thead>
                <tbody>{(["launch", "transit", "surface"] as AtmKey[]).map((k) => (
                  <tr key={k}><td style={{ textTransform: "capitalize" }}>{k}</td>
                    <td><input type="number" step="0.1" min="15" max="40" value={m.atm[k].o2} onChange={(e) => set((d) => { d.atm[k].o2 = +e.target.value; })} aria-label={`${k} oxygen`} /></td>
                    <td><input type="number" step="0.1" min="4" max="15" value={m.atm[k].psia} onChange={(e) => set((d) => { d.atm[k].psia = +e.target.value; })} aria-label={`${k} pressure`} /></td></tr>
                ))}</tbody>
              </table></div>
              <div style={{ marginTop: 12 }}>
                <div className="fld"><label htmlFor="u">Cabin airflow, cm/s</label><input id="u" type="number" step="0.5" min="0" max="40" value={m.u} onChange={(e) => set((d) => { d.u = +e.target.value; })} /></div>
                <div className="fld"><label htmlFor="band">Caution point: O₂ band above design, points</label><input id="band" type="number" step="0.1" min="0" max="5" value={m.band} onChange={(e) => set((d) => { d.band = +e.target.value; })} /></div>
                <div className="fld"><label htmlFor="tw">O₂ trend window, simulated minutes</label><input id="tw" type="number" step="1" min="2" max="30" value={m.trendMin} onChange={(e) => set((d) => { d.trendMin = +e.target.value; })} /></div>
                <div className="fld"><label htmlFor="det">Smoke detectors during dust work</label>
                  <select id="det" value={m.det} onChange={(e) => set((d) => { d.det = e.target.value as Mission["det"]; })}><option value="inhibit">Inhibited (ISS practice)</option><option value="always">Always armed</option></select></div>
              </div>
            </div>
            <div className="tw">
              <table className="tbl">
                <thead><tr><th>Item</th><th>Material</th><th>Exposed</th><th>Stowable</th><th>mm</th><th /></tr></thead>
                <tbody>{m.inv.map((it, i) => (
                  <tr key={i}>
                    <td><input value={it.label} onChange={(e) => setItem(i, (x) => { x.label = e.target.value; })} aria-label="Item name" /></td>
                    <td><select value={it.key} onChange={(e) => setItem(i, (x) => { x.key = e.target.value; })} aria-label="Material">{MATS.map((mt) => <option key={mt.key} value={mt.key}>{mt.name}</option>)}</select></td>
                    <td><input type="checkbox" checked={it.exposed} onChange={(e) => setItem(i, (x) => { x.exposed = e.target.checked; })} aria-label="Exposed" /></td>
                    <td><input type="checkbox" checked={it.stow} onChange={(e) => setItem(i, (x) => { x.stow = e.target.checked; })} aria-label="Stowable" /></td>
                    <td>{it.key === "pmma" ? <input type="number" step="0.5" min="0.5" max="20" value={it.t ?? 4} onChange={(e) => setItem(i, (x) => { x.t = +e.target.value; x.sides ??= "one"; })} aria-label="Thickness" /> : <span className="muted">—</span>}</td>
                    <td><button className="btn ghost" style={{ height: 30, padding: "0 8px" }} onClick={() => set((d) => { d.inv.splice(i, 1); })} aria-label={`Remove ${it.label}`}>×</button></td>
                  </tr>
                ))}</tbody>
              </table>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => set((d) => { d.inv.push({ label: "New item", key: "nomex", exposed: true, stow: true }); })}>Add item</button>
            </div>
          </div>
        </details>

        <div className="go">
          <span className="muted" style={{ fontSize: 13 }}>About 90 seconds from T−1 min to the lunar surface. Press D for the dashboard, Space to pause.</span>
          <button className="btn primary big" onClick={() => onLaunch({ ...m, name: m.name })}>Launch</button>
        </div>
      </div>
    </div>
  );
}
