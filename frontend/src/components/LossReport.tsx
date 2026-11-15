import { LIMITS, REF } from "../lib/fire";
import { fmtMET, type Simulation } from "../lib/sim";
import { SC } from "../lib/ui";

/** After a loss: what PrF-G said, when, what the crew did, and which NASA limit was crossed. */
export function LossReport({ sim, onReplay, onNew }: { sim: Simulation; onReplay: () => void; onNew: () => void }) {
  const f = sim.fire!, notes = [...sim.notices].reverse();
  const first = notes[0], caution = notes.find((n) => n.level === "CAUTION");
  const ign = f.met0, peakP = Math.max(...f.history.map((h) => h.psia), f.p0 + f.dp), peakQ = Math.max(...f.history.map((h) => h.q), f.q);
  const lostCrew = f.cause === "co";
  const rows: [string, string, string][] = [];
  if (first) rows.push([fmtMET(first.at), `PrF-G ${first.level.toLowerCase()}: fire margin ${first.status}`, first.why]);
  if (caution && caution !== first) rows.push([fmtMET(caution.at), `PrF-G caution: fire margin ${caution.status}`, caution.why]);
  if (caution) rows.push([caution.ackAt != null ? fmtMET(caution.ackAt) : "—", caution.ackAt != null ? "Caution acknowledged, not fixed" : "Caution never acknowledged", caution.optionTitles.length ? `Options on screen: ${caution.optionTitles.join("; ")}` : "No option was available"]);
  rows.push([fmtMET(ign), `Ignition: ${f.item.label} (${f.name})`, `${f.regime}; growth treated as NFPA "${f.growth}"`]);
  rows.push([f.detectedAt != null ? fmtMET(ign + f.detectedAt) : "—", f.detectedAt != null ? `Smoke detectors alarm (+${f.detectedAt.toFixed(0)} s)` : "Not detected", f.inhibited ? "Detectors were inhibited for dust work" : "Detectors armed"]);
  rows.push([f.responseAt != null ? fmtMET(ign + f.responseAt) : "—", f.responseAt != null ? "Vehicle fire response started" : "No fire response executed", ""]);
  rows.push([fmtMET(ign + (f.endedAt ?? f.t)), lostCrew ? "LOSS OF CREW" : "LOSS OF VEHICLE", lostCrew ? `CO reached ${f.co.toFixed(0)} mg/m³` : `Cabin pressure reached ${f.burst} psia`]);

  const W = 360, H = 90, hs = f.history, tMax = Math.max(1, hs[hs.length - 1]?.t ?? 1), pMax = Math.max(f.burst, peakP) * 1.05;
  const X = (t: number) => (t / tMax) * W, Y = (p: number) => H - (p / pMax) * H;
  return (
    <div className="scrim loss">
      <div className="dash" role="dialog" aria-modal="true" aria-label="Loss report">
        <div className="dhead">
          <h2 style={{ color: "var(--fire)" }}>{lostCrew ? "LOSS OF CREW" : "LOSS OF VEHICLE"}</h2>
          <span className="eyebrow">{sim.mission.name} · {sim.phase.name} · {fmtMET(ign + (f.endedAt ?? f.t))}</span>
          <span className="sp" />
          <button className="btn" onClick={onReplay}>Replay this mission</button>
          <button className="btn primary" onClick={onNew}>New mission</button>
        </div>
        <p className="lead" style={{ margin: 0 }}>
          {caution ? <>PrF-G raised a caution {((ign - caution.at) / 60).toFixed(0)} min before ignition. It {caution.ackAt != null ? "was acknowledged but" : "was"} not fixed.</> : <>The fire started with no caution active.</>}{" "}
          {f.responseAt == null ? "No fire response was executed after the alarm." : "The fire response came too late."}
        </p>
        <div className="mid">
          <section className="sect">
            <h4>Timeline</h4>
            <div className="ltl">{rows.map(([t, a, b], i) => (
              <div key={i} className={"lrow" + (i === rows.length - 1 ? " end" : "")}><span className="w mono">{t}</span><span><b>{a}</b>{b && <small>{b}</small>}</span></div>
            ))}</div>
          </section>
          <section className="sect">
            <h4>Against NASA limits</h4>
            <table className="tbl lim">
              <thead><tr><th>Metric</th><th>Value</th><th>Limit</th><th>Source</th></tr></thead>
              <tbody>
                <tr><td>Peak cabin pressure</td><td className="mono" style={{ color: "var(--fire)" }}>{peakP.toFixed(1)} psia</td><td>15.0 psia crew · {f.burst} psia structural</td><td>NASA-STD-3001 V2 6006 · Apollo 204 Review Board (≥29 psia rupture)</td></tr>
                <tr><td>Carbon monoxide</td><td className="mono" style={{ color: f.co > LIMITS.co24h ? "var(--fire)" : undefined }}>{f.co.toFixed(0)} mg/m³</td><td>{LIMITS.co1h} mg/m³ (1 h) · {LIMITS.co24h} (24 h)</td><td>JSC 20584 Rev C SMACs</td></tr>
                <tr><td>Peak heat release</td><td className="mono">{peakQ.toFixed(0)} kW</td><td>—</td><td>NFPA 72 t² growth, α = {REF.alpha[f.growth]} kW/s²</td></tr>
                <tr><td>Flame spread reference</td><td className="mono">{f.spread.v != null ? `${f.spread.v} mm/s` : "no NASA rate"}</td><td>—</td><td>{f.spread.run ? `NASA ${f.spread.run}, microgravity. At these conditions the real rate is unknown.` : "No NASA spread data for this material."}</td></tr>
              </tbody>
            </table>
            <svg viewBox={`0 0 ${W} ${H}`} className="o2chart" style={{ height: 96, marginTop: 10 }} preserveAspectRatio="none" role="img" aria-label="Cabin pressure during the fire">
              <line x1="0" x2={W} y1={Y(LIMITS.pMax)} y2={Y(LIMITS.pMax)} stroke="#ffc233" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              <line x1="0" x2={W} y1={Y(f.burst)} y2={Y(f.burst)} stroke="#ff2d2d" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              <polyline fill="none" stroke="#ff7a1a" strokeWidth="1.8" vectorEffect="non-scaling-stroke" points={hs.map((h) => `${X(h.t).toFixed(1)},${Y(h.psia).toFixed(1)}`).join(" ")} />
            </svg>
            <div className="muted" style={{ fontSize: 11.5 }}>Cabin pressure over {tMax.toFixed(0)} s · amber: NASA crew limit · red: structural limit</div>
          </section>
        </div>
        <section className="sect">
          <h4>What would have prevented it</h4>
          <p style={{ margin: 0, color: "var(--ink-2)" }}>{caution?.optionTitles.length ? `Approving ${caution.optionTitles.join(" or ")} when the caution appeared. ` : ""}Executing the vehicle fire response within the alarm window. PrF-G never acts on its own: the crew decides.</p>
        </section>
        <div className="foot">
          <span>Model: closed cabin with no venting (as in Apollo 204), {sim.mission.volume} m³; one heat of combustion and CO yield for all materials (SFPE, PMMA: {REF.dHc / 1000} MJ/kg, {REF.yCO} g/g); detector delay {REF.detectArmed} s armed / {REF.detectInhibited} s inhibited (demo values). Limits are NASA's; growth physics is standard fire engineering.</span>
          <span style={{ color: SC.LOW }}>Simulation only.</span>
        </div>
      </div>
    </div>
  );
}
