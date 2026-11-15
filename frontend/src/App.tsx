import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Sky } from "./components/Sky";
import { FireBanner, Header, Rail, Ring, Timeline, ToastBar } from "./components/Hud";
import { LossReport } from "./components/LossReport";
import { Dashboard } from "./components/Dashboard";
import { Launch } from "./components/Launch";
import { PRESETS, type Mission } from "./lib/mission";
import { Simulation } from "./lib/sim";

export default function App() {
  const simRef = useRef<Simulation>(); simRef.current ??= new Simulation(PRESETS.lunar);
  const sim = simRef.current;
  const stage = useRef<HTMLDivElement>(null);
  const [, render] = useReducer((x: number) => x + 1, 0);
  const [launched, setLaunched] = useState(false);
  const [dash, setDash] = useState(false);
  const [voice, setVoice] = useState(false);
  const [pulse, setPulse] = useState(false);
  const voiceRef = useRef(voice); voiceRef.current = voice;

  useEffect(() => sim.subscribe(render) as () => void, [sim]);

  // alerts: pulse the ring and optionally speak (NASA recommends speech alerts over tones)
  useEffect(() => {
    sim.onAlert = (lvl, text) => {
      setPulse(true); setTimeout(() => setPulse(false), 4300);
      if (voiceRef.current && "speechSynthesis" in window) {
        try { const u = new SpeechSynthesisUtterance(`PrF-G ${lvl.toLowerCase()}. ${text}`); u.rate = 1.02; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* speech unavailable */ }
      }
    };
    sim.onFire = (stage) => {
      const say = stage === "detected" ? "Fire. Fire. Vehicle smoke alarm." : stage === "lost" ? "Signal lost." : null;
      if (stage === "detected" || stage === "lost") setDash(false);
      if (say && voiceRef.current && "speechSynthesis" in window) { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(say)); } catch { /* speech unavailable */ } }
    };
  }, [sim]);

  // simulation clock: physics every frame, React at ~5 Hz
  useEffect(() => {
    let raf = 0, last = performance.now(), lastEmit = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (sim.running) sim.step(dt);
      if (t - lastEmit > 200) { lastEmit = t; sim.emit(); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  const open = useCallback(() => { setDash(true); sim.toast = null; }, [sim]);
  const close = useCallback(() => setDash(false), []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!launched || (e.target as HTMLElement).closest("input,select,textarea")) return;
      if (e.code === "Space") { e.preventDefault(); sim.running = !sim.running; sim.emit(); }
      if (e.key === "d" || e.key === "D") setDash((d) => !d);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [launched, sim]);

  const launch = (m: Mission) => { sim.reset(m); sim.running = true; setLaunched(true); setDash(false); };
  const replay = () => { sim.reset(sim.mission); sim.running = true; setDash(false); };
  const restart = () => { sim.running = false; setDash(false); setLaunched(false); sim.emit(); };

  return (
    <div className="app">
      <Sky sim={sim} stage={stage} />
      <div className="hud">
        <Header sim={sim} />
        <Ring sim={sim} onOpen={open} pulse={pulse} />
        <div ref={stage} className="stage" aria-hidden="true" />
        <Rail sim={sim} />
        <Timeline sim={sim} voice={voice} setVoice={setVoice} onRestart={restart} />
      </div>
      {launched && !dash && <ToastBar sim={sim} onOpen={open} />}
      {launched && !sim.lost && <FireBanner sim={sim} />}
      {launched && sim.lost && <LossReport sim={sim} onReplay={replay} onNew={restart} />}
      {dash && <Dashboard sim={sim} onClose={close} />}
      {!launched && <Launch onLaunch={launch} />}
    </div>
  );
}
