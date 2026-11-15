import { useEffect, useState } from "react";
import { GP_ERR, KPA, material } from "../lib/engine";
import { API_URL, ask, fetchMLP, type MLPResult } from "../lib/api";
import { nnModel, onNN, runNN } from "../lib/nn";
import { fmtMET, fmtTrend, type Simulation, type View } from "../lib/sim";
import { fmtEta, type Target } from "../lib/trend";
import { LOG_C, MC, SC, STATUS_LEAD, f1, sign } from "../lib/ui";

function Proj({ sim }: { sim: Simulation }) {
  const p = sim.proj;
  const cell = (t: Target | null, eyebrow: string, cap: string) => (
    <div className="pcell" style={{ ["--c" as string]: t?.state === "reached" ? (eyebrow.startsWith("Caution") ? "var(--warn)" : "var(--bad)") : t?.state === "eta" ? "var(--ink)" : "var(--muted)" }}>
      <div className="eyebrow">{eyebrow}{t ? ` · ${t.o2.toFixed(1)}%` : ""}</div>
      <div className="pv">{!t ? "—" : !p.ok ? "Unavailable" : fmtEta(t)}</div>
      <div className="cap">{cap}</div>
    </div>
  );
  return (
    <div className="projp">
      <div className="pcell">
        <div className="eyebrow">O₂ trend · last {p.window} min</div>
        <div className="pv mono">{p.ok ? `${p.b! >= 0 ? "+" : "−"}${Math.abs(p.b!).toFixed(2)}` : "—"}<small> pts/min</small></div>
        <div className="cap">{p.ok ? `${p.dir![0].toUpperCase() + p.dir!.slice(1)} · fitted now ${p.a!.toFixed(2)}% · ${p.n} readings` : `Projection unavailable: ${p.reason}.`}</div>
      </div>
      {cell(p.caution, "Caution point", `Design O₂ + ${sim.mission.band} pt band. Project setting, not a NASA limit.`)}
      {cell(p.edge, "Tested-evidence edge", p.edge ? `${p.edge.label.replace("Tested edge · ", "")}: highest O₂ with a NASA result. Beyond it is untested, not a fire threshold.` : "No exposed material has a transcribed O₂ ceiling.")}
      <div className="pfoot">Linear fit on simulated minutes, recalculated every reading. A projection, not a fire prediction.</div>
    </div>
  );
}

function Gauge({ pct, color }: { pct: number; color: string }) {
  const r = 26, c = Math.PI * r;
  return (
    <svg viewBox="0 0 64 36" aria-hidden="true">
      <path d="M6 32 A26 26 0 0 1 58 32" fill="none" stroke="rgba(140,180,220,.16)" strokeWidth="6" strokeLinecap="round" />
      {pct > 0 && <path d="M6 32 A26 26 0 0 1 58 32" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} style={{ transition: "stroke-dasharray .6s" }} />}
    </svg>
  );
}

function localAnswer(q: string, v: View, sim: Simulation): { answer: string; runs: string[] } {
  const s = q.toLowerCase();
  if (s.includes("why")) return { answer: `Status ${v.status}. ${v.reasons.map((r) => r.t).join(" ")}`, runs: [] };
  if (s.includes("weak") || s.includes("closest")) {
    if (!v.weakest || v.head == null) return { answer: "No exposed material has a transcribed oxygen ceiling to compare against.", runs: [] };
    return { answer: `${v.weakest.label} has the lowest highest-tested O₂: ${f1(v.weakest.o2)}%. The cabin is at ${f1(v.cabin.o2)}%, so the headroom is ${sign(v.head)} points. Above that NASA has no result, which is "untested", not "unsafe".`, runs: v.materials.find((m) => m.item.label === v.weakest!.label)?.s.runs ?? [] };
  }
  if (s.includes("evidence") || s.includes("source")) {
    const runs = [...new Set(v.materials.flatMap((m) => m.s.runs))];
    return { answer: runs.length ? `This assessment uses ${runs.length} NASA run(s). Each material card shows its own source.` : "No flight run backs the current conditions; materials are model-supported or untested.", runs };
  }
  if (s.includes("when") || s.includes("limit") || s.includes("trend")) {
    const p = sim.proj;
    return { answer: !p.ok ? `No projection: ${p.reason}. I will not estimate a time without enough readings.` : `${fmtTrend(p)}. Tested-evidence edge${p.edge ? ` (${p.edge.o2.toFixed(1)}%)` : ""}: ${p.edge ? fmtEta(p.edge).toLowerCase() : "none to compare"}. Linear trend of telemetry, not a fire prediction.`, runs: [] };
  }
  if (s.includes("option") || s.includes("do")) {
    const o = sim.options();
    return { answer: o.length ? o.map((x) => `${x.title}: ${x.from} → ${x.to}.`).join(" ") + " The crew decides; PrF-G only shows the projected status." : "No approved option changes the status right now. Keep following standard procedures.", runs: [] };
  }
  return { answer: "I answer from the evidence base only: try “Why this status?”, “Which material is weakest?”, “What evidence backs this?” or “What can we do?”.", runs: [] };
}

const QUESTIONS = ["Why this status?", "When do we reach the limits?", "Which material is weakest?", "What evidence backs this?", "What can we do?"];

function AskTab({ sim }: { sim: Simulation }) {
  const [a, setA] = useState<{ q: string; answer: string; runs: string[]; src: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const go = async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      if (API_URL && sim.apiState === "live") { const r = await ask(q, sim.cabin, sim.design.o2, sim.phase.g, sim.inv); setA({ q, ...r, src: "backend /ask" }); }
      else setA({ q, ...localAnswer(q, sim.view, sim), src: "on-board engine" });
    } catch { setA({ q, ...localAnswer(q, sim.view, sim), src: "on-board engine (backend unreachable)" }); }
    setBusy(false);
  };
  return (
    <div>
      <div className="chips">{QUESTIONS.map((q) => <button key={q} onClick={() => go(q)}>{q}</button>)}</div>
      <form style={{ display: "flex", gap: 8, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); go(text); setText(""); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about the current margin…" aria-label="Ask PrF-G" style={{ flex: 1, minWidth: 0, background: "#050a10", border: "1px solid var(--edge-2)", borderRadius: 10, padding: "8px 10px" }} />
        <button className="btn">Ask</button>
      </form>
      <div className="answer" aria-live="polite">
        {busy ? <span className="muted">Checking the evidence…</span> : a ? <>
          <div className="eyebrow" style={{ marginBottom: 4 }}>{a.q} · {a.src}</div>
          <div>{a.answer}</div>
          {a.runs.length > 0 && <div className="cite">{a.runs.join(" · ")}</div>}
        </> : <span className="muted">Answers come from NASA test records, never from a language model guess.</span>}
      </div>
    </div>
  );
}

function NNTab({ sim }: { sim: Simulation }) {
  const [, force] = useState(0);
  const [mlp, setMlp] = useState<MLPResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => onNN(() => force((x) => x + 1)), []);
  // poll the backend MLP while this tab is open (it never feeds back into the simulation)
  useEffect(() => {
    if (!API_URL) return;
    let alive = true, ctl: AbortController | null = null;
    const tick = () => {
      ctl?.abort(); ctl = new AbortController();
      fetchMLP(sim.cabin, sim.phase.g, sim.inv, ctl.signal).then((r) => { if (alive) { setMlp(r); setErr(null); } })
        .catch((e) => { if (alive && e.name !== "AbortError") setErr("Backend unreachable"); });
    };
    tick(); const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); ctl?.abort(); };
  }, [sim]);

  const v = sim.view, m = nnModel(), pm = sim.inv.find((i) => i.exposed && i.key === "pmma");
  const x = { o2_pct: +v.cabin.o2.toFixed(2), pressure_kpa: +(v.cabin.psia * KPA).toFixed(1), flow_cm_s: +v.cabin.u.toFixed(1), gravity_g: v.g === "micro" ? 0 : v.g === "lunar" ? 0.166 : 1, thickness_mm: pm?.t ? (pm.sides === "two" ? pm.t / 2 : pm.t) : null };
  const out = runNN(x);
  const rows = v.materials.map(({ item, s }) => ({ item, s, nn: mlp?.per_material.find((r) => r.material === item.key) }));
  return (
    <div className="ai">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <b>{mlp ? "P3 neural network · sustained burning yes/no" : m ? m.name : API_URL ? (err ?? "Connecting to the MLP…") : "MLP not connected"}</b>
        <span className="fw">Second opinion · cannot change status, alerts or options</span>
      </div>
      <div className="nnrow"><span className="muted">Inputs</span><span className="mono" style={{ fontSize: 12 }}>O₂ {x.o2_pct}% · {x.pressure_kpa} kPa · {x.flow_cm_s} cm/s · {x.gravity_g} g{x.thickness_mm ? ` · ${x.thickness_mm} mm` : ""}</span></div>
      {mlp ? (
        <div className="tw" style={{ marginTop: 6 }}>
          <table className="tbl nn">
            <thead><tr><th>Material</th><th>Evidence engine (NASA tests)</th><th>Neural network: sustained burning</th><th>Training domain</th></tr></thead>
            <tbody>{rows.map(({ item, s, nn }) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td><span style={{ color: MC[s.st] }}>{s.lab}</span></td>
                <td className="mono">{!nn || !nn.scores ? <span className="muted">no training data</span>
                  : <><span className="nnbar"><i style={{ width: `${nn.scores.yes * 100}%` }} /></span> {nn.predicted === "yes" ? "likely" : "unlikely"} · score {nn.scores.yes.toFixed(2)}</>}</td>
                <td>{!nn || !nn.scores ? "—" : nn.in_domain ? <span style={{ color: "var(--ok)" }}>inside</span> : <span style={{ color: "var(--warn)" }} title={nn.issues.join("; ")}>outside: {nn.issues[0]}</span>}</td>
              </tr>))}</tbody>
          </table>
          <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>{mlp.note} Where the two disagree, the crew sees both; the status still comes from the NASA evidence.</p>
        </div>
      ) : (
        <>
          <div className="nnrow"><span className="muted">Evidence engine (GP)</span><span className="mono">{v.spread != null ? `${v.spread.toFixed(3)} mm/s ×${GP_ERR.toFixed(2)}` : "outside model domain"}</span></div>
          <div className="nnrow"><span className="muted">Neural network</span><span className="mono">{!out ? (API_URL ? (err ?? "loading") : "awaiting model") : "error" in out ? "model error, ignored" : `${out.value != null ? out.value.toFixed(3) : out.label}${out.unit ? " " + out.unit : ""}`}</span></div>
          {!m && !API_URL && <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Runs on the backend: build with <code className="mono">VITE_API_URL</code> set, or plug a local model in with <code className="mono">window.PrFG.connectMLP(name, fn)</code>.</p>}
        </>
      )}
    </div>
  );
}

export function Dashboard({ sim, onClose }: { sim: Simulation; onClose: () => void }) {
  const v = sim.view, [open, setOpen] = useState<string | null>(null), [tab, setTab] = useState<"ask" | "nn" | "log">("ask");
  const opts = sim.options(), col = SC[v.status], standby = v.status === "STANDBY", n = sim.active;
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const src = sim.apiState === "live" && v.source === "api" ? { cls: "src live", t: "Backend live" } : sim.apiState === "off" ? { cls: "src", t: "On-board engine" } : { cls: "src", t: "Backend offline · on-board engine" };

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dash" role="dialog" aria-modal="true" aria-label="PrF-G dashboard">
        <div className="dhead">
          <h2>PrF-G</h2><span className="eyebrow">Fire margin · {sim.phase.name} · {fmtMET(sim.met)}</span>
          <span className="sp" /><span className={src.cls}><i />{src.t}</span>
          <button className="btn" onClick={onClose} aria-label="Close dashboard">Close</button>
        </div>

        <div className="top">
          <section className="status" style={{ ["--sc" as string]: col }}>
            <div className="eyebrow">Evidence status{n ? ` · ${n.level === "CAUTION" ? "Caution" : "Advisory"} notice` : " · no active notice"}</div>
            <div className="word">{v.status}</div>
            <div className="lead">{v.reasons[0]?.t ?? STATUS_LEAD[v.status]}</div>
            {v.reasons.length > 1 && <ul>{v.reasons.slice(1).map((r) => <li key={r.k}>{r.t}</li>)}</ul>}
            {v.confirming && <div className="confirm">Improvement to {v.raw} detected. Confirming before the notice clears…</div>}
            {n && (
              <div className="notice" style={{ ["--c" as string]: n.level === "CAUTION" ? "var(--bad)" : "var(--warn)" }}>
                <div className="nh"><span className="pill">{n.level}</span><span className={"ackst" + (n.ack ? " done" : "")}>{n.ack ? "Acknowledged · still active" : "New"}</span><span className="muted mono">issued {fmtMET(n.at)}</span>
                  {!n.ack && <button className="btn primary" onClick={() => sim.acknowledge()}>Acknowledge</button>}</div>
                <div className="nd"><span>At issue</span>{n.what}</div>
                <div className="nd"><span>Evidence</span>{n.evidence}</div>
              </div>
            )}
            <div className="acts"><span className="muted" style={{ fontSize: 12.5 }}>Decision support only. The crew decides; the vehicle's caution &amp; warning system is unchanged.</span></div>
          </section>
          <div className="metrics">
            <div className="metric"><div className="eyebrow">Coverage</div><Gauge pct={standby ? 0 : v.pct} color={col} /><div className="big">{standby ? "—" : v.pct}<small>%</small></div><div className="cap">{standby ? "Starts in orbit" : `${v.covered} of ${v.burnable} burnable materials tested here`}</div></div>
            <div className="metric"><div className="eyebrow">O₂ headroom</div>
              <div className="big" style={{ color: v.head != null && v.head < 0 ? "var(--bad)" : undefined }}>{v.head != null && !standby ? sign(v.head) : "—"}<small>pts</small></div>
              <div className="cap">{v.weakest && !standby ? `to the highest tested O₂ for ${v.weakest.label} (${f1(v.weakest.o2)}%)` : "No ceiling to compare"}</div></div>
            <div className="metric"><div className="eyebrow">Predicted spread</div>
              <div className="big">{v.spread != null ? v.spread.toFixed(2) : "—"}<small>mm/s</small></div>
              <div className="cap">{v.spread != null ? `PMMA, Gaussian process, typical error ×${GP_ERR.toFixed(2)}` : "Only inside the BASS-II model domain"}</div></div>
            {!standby && <Proj sim={sim} />}
          </div>
        </div>

        <div className="mid">
          <section className="sect">
            <h4>Crew options <span className="muted" style={{ letterSpacing: 0, textTransform: "none", fontFamily: "var(--f-body)", fontWeight: 400 }}>Projected effect, from the same evidence</span></h4>
            {opts.length ? opts.map((o) => (
              <div className="opt" key={o.id}>
                <div className="t">{o.title}</div>
                <div className="e">{o.detail}</div>
                <div className="proj">
                  <span className="pill" style={{ ["--c" as string]: SC[o.from] }}>{o.from}</span><span className="muted">→</span><span className="pill" style={{ ["--c" as string]: SC[o.to] }}>{o.to}</span>
                  <span className="muted mono">coverage {o.pctFrom}% → {o.pctTo}%</span>
                </div>
                <div className="acts"><button className="btn primary" onClick={() => sim.decide(o, true)}>Approve</button><button className="btn ghost" onClick={() => sim.decide(o, false)}>Decline</button></div>
              </div>
            )) : <div className="empty">{standby ? "Options appear once screening starts in orbit." : "No option changes the status right now. Standard procedures apply."}</div>}
          </section>
          <section className="sect">
            <h4>Exposed materials <span className="muted mono" style={{ letterSpacing: 0 }}>{sim.inv.filter((i) => i.exposed).length} exposed · {sim.inv.filter((i) => !i.exposed).length} stowed</span></h4>
            <div className="mats">
              {v.materials.map(({ item, s }) => (
                <div key={item.label}>
                  <button className="mrow" style={{ ["--c" as string]: MC[s.st] }} onClick={() => setOpen(open === item.label ? null : item.label)} aria-expanded={open === item.label}>
                    <span className="sw" />
                    <span style={{ minWidth: 0 }}><b>{item.label}</b><span className="m">{material(item.key)?.name} · {s.txt}</span></span>
                    <span className="s">{s.lab}</span>
                  </button>
                  {open === item.label && <div className="mdetail">{s.why}{s.runs.length > 0 && <div className="runs">{s.runs.join(" · ")}</div>}</div>}
                </div>
              ))}
              {sim.inv.filter((i) => !i.exposed).map((i) => (
                <div className="mrow stowed" key={i.label} style={{ ["--c" as string]: "var(--muted)" }}><span className="sw" /><span><b>{i.label}</b><span className="m">Stowed: not counted</span></span><span className="s">Stowed</span></div>
              ))}
            </div>
          </section>
        </div>

        <section className="sect">
          <div className="tabs" role="tablist">
            {([["ask", "Ask PrF-G"], ["nn", "Neural network"], ["log", `Decision log · ${sim.log.length}`]] as const).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t}</button>
            ))}
          </div>
          {tab === "ask" && <AskTab sim={sim} />}
          {tab === "nn" && <NNTab sim={sim} />}
          {tab === "log" && sim.notices.length > 0 && <div className="nlist">{sim.notices.map((x) => (
            <div key={x.id} className="nrow" style={{ ["--c" as string]: x.level === "CAUTION" ? "var(--bad)" : "var(--warn)" }}>
              <span className="pill">{x.level}</span><span><b>{x.status}</b> · {x.why}</span>
              <span className="w mono">{fmtMET(x.at)} · {x.resolvedAt != null ? `${x.resolution} ${fmtMET(x.resolvedAt)}` : x.ack ? "active, acknowledged" : "active, new"}</span>
            </div>))}</div>}
          {tab === "log" && <div className="log">{sim.log.map((l, i) => (
            <div className="l" key={i} style={{ ["--c" as string]: LOG_C[l.type] }}><span className="k">{l.type}</span><span>{l.text}</span><span className="w">{fmtMET(l.met)}</span></div>
          ))}</div>}
        </section>

        <div className="foot">
          <span>Evidence: 76 NASA microgravity records (BASS-II, Saffire I–V, TM-2008-215260). Ignition limits and spread tests kept apart.</span>
          <span>PrF-G never changes the atmosphere, alarms or suppression.</span>
        </div>
      </div>
    </div>
  );
}
