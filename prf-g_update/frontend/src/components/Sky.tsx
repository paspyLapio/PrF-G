import { useEffect, useRef, type RefObject } from "react";
import { PHASES, phaseIndex, phaseProgress, sstep } from "../lib/mission";
import type { Simulation } from "../lib/sim";
import { SC_HEX } from "../lib/ui";

type P = [number, number];
interface Geo { E: P; rE: number; M: P; rM: number; rL: number; rLL: number }
const TAU = Math.PI * 2;
const A0 = -Math.PI / 2 - 0.35, A_ASC = A0 + 1.1, A_DEP = 3.2 * Math.PI, B_ARR = 1.15 * Math.PI, C_END = B_ARR + TAU * 1.3;
const dir = (a: number): P => [Math.cos(a), Math.sin(a)];
const add = (p: P, q: P, k = 1): P => [p[0] + q[0] * k, p[1] + q[1] * k];

function bez(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
}

/** Position of the vehicle on the illustrated trajectory: phase id and progress 0..1. */
function pathPoint(g: Geo, id: string, x: number): P {
  const { E, rE, M, rM, rL, rLL } = g;
  if (id === "pad") return add(E, dir(A0), rE);
  if (id === "ascent") return add(E, dir(A0 + 1.1 * x), rE + (rL - rE) * Math.pow(sstep(x), 0.8));
  if (id === "leo") return add(E, dir(A_ASC + (A_DEP - A_ASC) * x), rL);
  if (id === "tli") {
    const p0 = add(E, dir(A_DEP), rL), p3 = add(M, dir(B_ARR), rLL), d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
    const t0: P = [-Math.sin(A_DEP), Math.cos(A_DEP)], t3: P = [-Math.sin(B_ARR), Math.cos(B_ARR)];
    return bez(p0, add(p0, t0, d * 0.42), add(p3, t3, -d * 0.42), p3, x);
  }
  if (id === "llo") return add(M, dir(B_ARR + (C_END - B_ARR) * x), x < 0.8 ? rLL : rLL - (rLL - rM) * sstep((x - 0.8) / 0.2));
  return add(M, dir(C_END), rM);
}

interface Star { x: number; y: number; r: number; a: number; tw: number }

export function Sky({ sim, stage }: { sim: Simulation; stage: RefObject<HTMLDivElement> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext("2d")!;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const stars: Star[] = Array.from({ length: 260 }, () => ({ x: rnd(), y: rnd(), r: rnd() < 0.08 ? 1.4 : 0.4 + rnd() * 0.7, a: 0.25 + rnd() * 0.6, tw: rnd() * TAU }));
    const trail: P[] = [];
    let raf = 0, w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    };
    resize(); window.addEventListener("resize", resize);

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (cv.clientWidth !== w || cv.clientHeight !== h) resize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#03060b"; ctx.fillRect(0, 0, w, h);
      const neb = ctx.createRadialGradient(w * 0.62, h * 0.3, 0, w * 0.62, h * 0.3, Math.max(w, h) * 0.7);
      neb.addColorStop(0, "rgba(70,80,160,0.10)"); neb.addColorStop(0.5, "rgba(30,60,110,0.05)"); neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(t / 900 + s.tw));
        ctx.fillStyle = "#dfe9ff"; ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // geometry from the empty stage area of the HUD, so nothing hides behind panels
      const cr = cv.getBoundingClientRect(), sr = stage.current?.getBoundingClientRect();
      const x = sr ? sr.left - cr.left : 0, y = sr ? sr.top - cr.top : 0, sw = sr?.width || w, sh = sr?.height || h;
      const rE = Math.max(30, Math.min(sh * 0.15, sw * 0.085));
      const g: Geo = { E: [x + sw * 0.17, y + sh * 0.64], rE, M: [x + sw * 0.84, y + sh * 0.3], rM: rE * 0.32, rL: rE * 1.3, rLL: Math.max(rE * 0.32 * 2.3, 16) };

      // Earth
      const [ex, ey] = g.E;
      const atm = ctx.createRadialGradient(ex, ey, rE * 0.9, ex, ey, rE * 1.5);
      atm.addColorStop(0, "rgba(110,190,255,0.32)"); atm.addColorStop(1, "rgba(110,190,255,0)");
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(ex, ey, rE * 1.5, 0, TAU); ctx.fill();
      const eg = ctx.createRadialGradient(ex - rE * 0.45, ey - rE * 0.5, rE * 0.1, ex, ey, rE);
      eg.addColorStop(0, "#5fb3f0"); eg.addColorStop(0.45, "#1f5f9e"); eg.addColorStop(1, "#081a33");
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, rE, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, rE, 0, TAU); ctx.clip();
      ctx.globalAlpha = 0.1; ctx.fillStyle = "#cfeee0";
      for (let i = 0; i < 6; i++) { const a = i * 1.1 + t / 60000; ctx.beginPath(); ctx.ellipse(ex + Math.cos(a) * rE * 0.5, ey + Math.sin(a * 1.3) * rE * 0.45, rE * 0.28, rE * 0.14, a, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      const term = ctx.createLinearGradient(ex - rE, ey - rE, ex + rE, ey + rE);
      term.addColorStop(0.45, "rgba(3,6,11,0)"); term.addColorStop(1, "rgba(3,6,11,0.78)");
      ctx.fillStyle = term; ctx.fillRect(ex - rE, ey - rE, rE * 2, rE * 2); ctx.restore();

      // Moon
      const [mx, my] = g.M, rM = g.rM;
      const mg = ctx.createRadialGradient(mx - rM * 0.4, my - rM * 0.4, rM * 0.1, mx, my, rM);
      mg.addColorStop(0, "#e9edf2"); mg.addColorStop(0.6, "#9aa3ae"); mg.addColorStop(1, "#3b414a");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, rM, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(40,46,56,0.35)";
      [[-0.3, -0.1, 0.22], [0.25, 0.3, 0.16], [0.1, -0.45, 0.12]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(mx + a * rM, my + b * rM, r * rM, 0, TAU); ctx.fill(); });

      // orbits
      ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(140,180,220,0.22)";
      ctx.beginPath(); ctx.arc(ex, ey, g.rL, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx, my, g.rLL, 0, TAU); ctx.stroke();

      // full path (faint) and travelled path
      const pi = phaseIndex(sim.met), px = phaseProgress(sim.met);
      const N = 70, pts: P[] = [], done: P[] = [];
      PHASES.forEach((p, i) => {
        if (p.id === "pad" || p.id === "surf") return;
        for (let k = 0; k <= N; k++) {
          const q = pathPoint(g, p.id, k / N); pts.push(q);
          if (i < pi || (i === pi && k / N <= px)) done.push(q);
        }
      });
      ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(140,180,220,0.28)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
      ctx.setLineDash([]);
      const cur = pathPoint(g, PHASES[pi].id, px);
      if (done.length > 1) {
        const lg = ctx.createLinearGradient(ex, ey, mx, my); lg.addColorStop(0, "#7fd4ff"); lg.addColorStop(1, "#b9a4ff");
        ctx.strokeStyle = lg; ctx.lineWidth = 2.4; ctx.shadowColor = "rgba(127,212,255,0.6)"; ctx.shadowBlur = 10;
        ctx.beginPath(); done.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // vehicle with a status halo
      trail.push(cur); if (trail.length > 24) trail.shift();
      const col = SC_HEX[sim.view.status], pulse = 0.5 + 0.5 * Math.sin(t / 380);
      const halo = ctx.createRadialGradient(cur[0], cur[1], 0, cur[0], cur[1], 26 + pulse * 6);
      halo.addColorStop(0, col + "aa"); halo.addColorStop(1, col + "00");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cur[0], cur[1], 32, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cur[0], cur[1], 3.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cur[0], cur[1], 9 + pulse * 2, 0, TAU); ctx.stroke();

      // labels
      ctx.font = '600 11px "Saira Semi Condensed", "Arial Narrow", system-ui, sans-serif';
      ctx.fillStyle = "rgba(169,185,201,0.85)"; ctx.textAlign = "center";
      ctx.fillText("E A R T H", ex, ey + rE + 22);
      ctx.fillText("M O O N", mx, my + Math.max(rM, g.rLL) + 20);
      ctx.textAlign = "left"; ctx.fillStyle = "rgba(127,212,255,0.75)";
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText(sim.veh.unit ? `${sim.veh.label.toUpperCase()} ${sim.veh.value} ${sim.veh.unit}` : "LUNAR SURFACE", cur[0] + 16, cur[1] - 12);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [sim, stage]);
  return <canvas ref={ref} className="sky" aria-hidden="true" />;
}
