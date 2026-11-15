import { useState } from "react";
import { PHASES, phaseIndex, phaseProgress } from "../lib/mission";
import { fmtMET, type Simulation } from "../lib/sim";
import { SC, f1 } from "../lib/ui";

export function Header({ sim }: { sim: Simulation }) {
  const p = sim.phase;
  return (
    <header className="mission">
      <div className="brand"><b>PrF-G</b><span>{sim.mission.name}</span></div>
      <div className="clock" aria-label="Mission elapsed time">{fmtMET(sim.met)}</div>
      <div className="phaseline">
        <span className="phasechip">{p.name}</span>
        <span className="eyebrow">{p.g === "1g" ? "1 g" : p.g === "micro" ? "Microgravity" : "Lunar 0.166 g"} · {f1(sim.design.o2)}% O₂ · {sim.design.psia} psia design</span>
      </div>
      <p className="caption" key={p.id}>{p.id === "surf" ? `Habitat at ${f1(sim.design.o2)}% O₂, ${sim.design.psia} psia, 0.166 g. NASA has no partial-gravity fire data, and PrF-G says so.`
        : p.id === "tli" ? `Cabin moves to the transit atmosphere (${f1(sim.design.o2)}% O₂, ${sim.design.psia} psia). Materials outside NASA's tested range are flagged.` : p.caption}</p>
    </header>
  );
}

export function Ring({ sim, onOpen, pulse }: { sim: Simulation; onOpen: () => void; pulse: boolean }) {
  const v = sim.view, r = 32, c = 2 * Math.PI * r, frac = v.status === "STANDBY" ? 1 : v.pct / 100;
  const n = sim.active;
  const sub = v.status === "STANDBY" ? "Standby under launch loads" : v.confirming ? `Improvement to ${v.raw} detected, confirming…` : `${v.covered} of ${v.burnable} materials covered`;
  return (
    <button className={"ring" + (pulse ? " pulse" : "")} style={{ ["--sc" as string]: SC[v.status] }} onClick={onOpen} aria-label={`Fire margin ${v.status}. Open the PrF-G dashboard`}>
      <svg viewBox="0 0 78 78" aria-hidden="true">
        <circle cx="39" cy="39" r={r} fill="none" stroke="rgba(140,180,220,0.16)" strokeWidth="6" />
        <circle cx="39" cy="39" r={r} fill="none" stroke={SC[v.status]} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 39 39)" style={{ transition: "stroke-dasharray .6s" }} />
        <text x="39" y="44" textAnchor="middle" fill="#eaf1f7" fontFamily="JetBrains Mono, monospace" fontSize="15">{v.status === "STANDBY" ? "—" : v.pct + "%"}</text>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow" style={n ? { color: n.level === "CAUTION" ? "var(--bad)" : "var(--warn)" } : undefined}>{n ? `${n.level} · ${n.ack ? "acknowledged" : "new"}` : "Fire margin"}</div>
        <div className="st">{v.status}</div>
        <div className="sub">{sub}</div>
        <div className="open">Open PrF-G dashboard ›</div>
      </div>
    </button>
  );
}

function O2Chart({ sim }: { sim: Simulation }) {
  const h = sim.o2History; if (h.length < 2) return <svg className="o2chart" />;
  const W = 300, H = 86, d = sim.design.o2, ceil = sim.view.weakest?.o2 ?? null, cp = d + sim.mission.band;
  const vals = h.map((q) => q[1]);
  const lo = Math.min(...vals, d) - 0.8, hi = Math.max(...vals, cp, ceil != null && sim.phase.g !== "1g" ? Math.min(ceil, Math.max(...vals) + 3) : d) + 0.8;
  const X = (i: number) => (i / (h.length - 1)) * W, Y = (o: number) => H - ((o - lo) / (hi - lo)) * H;
  const line = vals.map((o, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(o).toFixed(1)}`).join("");
  return (
    <svg className="o2chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Cabin oxygen, last 40 seconds">
      <defs><linearGradient id="o2f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fd4ff" stopOpacity=".28" /><stop offset="1" stopColor="#7fd4ff" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill="url(#o2f)" />
      <line x1="0" x2={W} y1={Y(d)} y2={Y(d)} stroke="#a9b9c9" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {sim.phase.g !== "1g" && <line x1="0" x2={W} y1={Y(cp)} y2={Y(cp)} stroke="#f5b84a" strokeDasharray="2 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      {ceil != null && sim.phase.g !== "1g" && ceil < hi && <line x1="0" x2={W} y1={Y(ceil)} y2={Y(ceil)} stroke="#ff6b5d" strokeDasharray="5 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      <path d={line} fill="none" stroke="#7fd4ff" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Rail({ sim }: { sim: Simulation }) {
  const v = sim.view, veh = sim.veh, c = v.cabin, ceil = v.weakest;
  return (
    <aside className="rail">
      <section className="card glass">
        <h3>Vehicle <span className="tag">Illustrative</span></h3>
        <div className="kv">
          <div><div className="k">{veh.label}</div><div className="v">{veh.value}<small>{veh.unit}</small></div></div>
          <div><div className="k">Velocity</div><div className="v">{veh.vel.toFixed(2)}<small>km/s</small></div></div>
          <div><div className="k">Accel</div><div className="v">{veh.g.toFixed(2)}<small>g</small></div></div>
        </div>
      </section>
      <section className="card glass">
        <h3>Cabin telemetry <span className="tag">Existing sensors</span></h3>
        <div className="kv">
          <div><div className="k">O₂</div><div className="v">{c.o2.toFixed(2)}<small>%</small></div></div>
          <div><div className="k">Pressure</div><div className="v">{c.psia.toFixed(2)}<small>psia</small></div></div>
          <div><div className="k">Airflow</div><div className="v">{f1(c.u)}<small>cm/s</small></div></div>
        </div>
        <O2Chart sim={sim} />
        <div className="rows">
          <div className="r"><span className="muted"><i className="dot" style={{ background: "#a9b9c9" }} />Design O₂</span><span className="v">{f1(sim.design.o2)}<small>%</small></span></div>
          {sim.phase.g !== "1g" && <div className="r"><span className="muted"><i className="dot" style={{ background: "var(--warn)" }} />Caution point</span><span className="v">{f1(sim.design.o2 + sim.mission.band)}<small>%</small></span></div>}
          {ceil && sim.phase.g !== "1g" && <div className="r"><span className="muted"><i className="dot" style={{ background: "var(--bad)" }} />Highest tested · {ceil.label}</span><span className="v">{f1(ceil.o2)}<small>%</small></span></div>}
          {sim.phase.g !== "1g" && <div className="r"><span className="muted">O₂ trend · {sim.proj.window} min</span><span className="v" style={{ fontSize: 13 }}>{sim.proj.ok ? `${sim.proj.b! >= 0 ? "+" : "−"}${Math.abs(sim.proj.b!).toFixed(2)} pts/min · ${sim.proj.dir}` : "unavailable"}</span></div>}
          <div className="r"><span className="muted">Smoke detectors</span><span className="v" style={{ color: sim.inhibited ? "var(--warn)" : "var(--ok)", fontSize: 13 }}>{sim.inhibited ? "INHIBITED · dust" : "ARMED"}</span></div>
        </div>
      </section>
    </aside>
  );
}

const EVENTS: { id: "drift" | "cargo" | "dust" | "fan"; t: string; d: string }[] = [
  { id: "drift", t: "O₂ valve drifts high", d: "Oxygen creeps up 0.24 points a minute" },
  { id: "cargo", t: "Cargo unpacked", d: "A stowed material becomes exposed" },
  { id: "dust", t: "Dust-generating work", d: "Smoke detectors inhibited (ISS practice)" },
  { id: "fan", t: "Cabin fan stops", d: "Airflow falls toward stagnant" },
];

export function Timeline({ sim, voice, setVoice, onRestart }: { sim: Simulation; voice: boolean; setVoice: (v: boolean) => void; onRestart: () => void }) {
  const [menu, setMenu] = useState(false);
  const pi = phaseIndex(sim.met), px = phaseProgress(sim.met), live = sim.phase.g !== "1g";
  return (
    <nav className="timeline glass" aria-label="Mission timeline">
      <div className="ctrl">
        <button className="ibtn" onClick={() => { sim.running = !sim.running; sim.emit(); }} aria-label={sim.running ? "Pause" : "Play"} title="Space">
          {sim.running ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
            : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor" /></svg>}
        </button>
        <button className="pbtn mono" onClick={() => { sim.speed = sim.speed === 1 ? 4 : 1; sim.emit(); }} aria-label="Simulation speed">{sim.speed}×</button>
      </div>
      <div className="track">
        {PHASES.map((p, i) => (
          <button key={p.id} className={"seg" + (i < pi ? " done" : i === pi ? " now" : "")} disabled={i <= pi} onClick={() => sim.jump(i)} title={i > pi ? `Skip to ${p.name}` : p.name} style={{ cursor: i > pi ? "pointer" : "default" }}>
            <span className="bar"><i style={{ width: `${i < pi ? 100 : i === pi ? px * 100 : 0}%` }} /></span>
            <span className="nm">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="ctrl">
        <button className="pbtn" aria-expanded={menu} onClick={() => setMenu(!menu)} disabled={!live} title={live ? "Inject an event" : "Available in orbit"} style={{ opacity: live ? 1 : 0.5 }}>Inject event</button>
        <button className="pbtn" aria-pressed={voice} onClick={() => setVoice(!voice)} title="Speak alerts">Voice</button>
        <button className="pbtn" onClick={onRestart}>New mission</button>
      </div>
      {menu && (
        <div className="popover glass" role="menu">
          {EVENTS.map((e) => <button key={e.id} role="menuitem" onClick={() => { sim.inject(e.id); setMenu(false); }}>{e.t}<small>{e.d}</small></button>)}
        </div>
      )}
    </nav>
  );
}

export function ToastBar({ sim, onOpen }: { sim: Simulation; onOpen: () => void }) {
  const n = sim.active;
  if (n && !n.ack) {
    const col = n.level === "CAUTION" ? "var(--bad)" : "var(--warn)";
    return (
      <div className="toast" role="alert" style={{ ["--sc" as string]: col }}>
        <span className="lvl">{n.level}</span>
        <span style={{ minWidth: 0 }}>
          <b>{n.title}.</b> {n.why}
          <span className="tsub">{n.what} · {n.trend}</span>
        </span>
        <button className="btn primary" onClick={onOpen}>{n.options ? `${n.options} option${n.options > 1 ? "s" : ""} in PrF-G` : "Open PrF-G"}</button>
        <button className="btn ghost" onClick={() => sim.acknowledge()}>Acknowledge</button>
      </div>
    );
  }
  const t = sim.toast;
  if (!t || performance.now() - t.at > 7000) return null;
  return (
    <div className="toast" role="status" style={{ ["--sc" as string]: "var(--ok)" }}>
      <span className="lvl">CLEARED</span><span style={{ minWidth: 0 }}>{t.text}</span>
      <button className="btn ghost" onClick={() => { sim.toast = null; sim.emit(); }}>Dismiss</button>
    </div>
  );
}
