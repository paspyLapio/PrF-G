import { useEffect, useRef, type RefObject } from "react";
import { phaseIndex, phaseProgress, phaseStarts, sstep, type Dest, type Shape } from "../lib/mission";
import type { Simulation } from "../lib/sim";
import { SC_HEX } from "../lib/ui";

type P = [number, number];
interface Geo { E: P; rE: number; D: P; rD: number; rL: number; rS: number; rDO: number; dest: Dest }
const TAU = Math.PI * 2;
const A0 = -Math.PI / 2 - 0.35, A_ASC = A0 + 1.1, A_DEP = 3.2 * Math.PI, A_PH = A_ASC + 3 * Math.PI;
const B_ARR = 1.15 * Math.PI, C_END = B_ARR + TAU * 1.3, OMEGA_ISS = TAU / 5550; // ISS ~92.5 min orbit
const ACCENT = "#ff7a1a", TRACK = "rgba(150,165,180,0.26)";
const dir = (a: number): P => [Math.cos(a), Math.sin(a)];
const add = (p: P, q: P, k = 1): P => [p[0] + q[0] * k, p[1] + q[1] * k];
const bez = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};
/** Near-rectilinear halo orbit drawn as an ellipse with the Moon at one focus. */
const nrho = (g: Geo, th: number): P => {
  const a = g.rD * 5.2, b = g.rD * 1.5, c = Math.sqrt(a * a - b * b), rot = -1.05;
  const x = a * Math.cos(th) - c, y = b * Math.sin(th);
  return [g.D[0] + x * Math.cos(rot) - y * Math.sin(rot), g.D[1] + x * Math.sin(rot) + y * Math.cos(rot)];
};
const arrival = (g: Geo): P => (g.dest === "station" ? add(g.E, dir(A_PH), g.rS) : nrhoRoute ? nrho(g, Math.PI) : add(g.D, dir(B_ARR), g.rDO));
let nrhoRoute = false;

function point(g: Geo, shape: Shape, x: number, met: number, start: number, landsNext: boolean): P {
  const { E, rE, D, rD, rL, rS, rDO } = g;
  switch (shape) {
    case "pad": return add(E, dir(A0), rE);
    case "ascent": return add(E, dir(A0 + 1.1 * x), rE + (rL - rE) * Math.pow(sstep(x), 0.8));
    case "orbit": return add(E, dir(A_ASC + (A_DEP - A_ASC) * x), rL);
    case "phasing": return add(E, dir(A_ASC + (A_PH - A_ASC) * x), rL + (rS - rL) * sstep(x));
    case "docked": return add(E, dir(A_PH + OMEGA_ISS * (met - start)), rS);
    case "transfer": {
      const p0 = add(E, dir(A_DEP), rL), p3 = arrival(g), d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
      const t0: P = [-Math.sin(A_DEP), Math.cos(A_DEP)], t3: P = nrhoRoute ? [0.35, -0.94] : [-Math.sin(B_ARR), Math.cos(B_ARR)];
      return bez(p0, add(p0, t0, d * 0.42), add(p3, t3, -d * 0.42), p3, x);
    }
    case "dorbit": return add(D, dir(B_ARR + (C_END - B_ARR) * x), !landsNext || x < 0.8 ? rDO : rDO - (rDO - rD) * sstep((x - 0.8) / 0.2));
    case "nrho": return nrho(g, Math.PI + (TAU * (met - start)) / 590000);
    default: return add(D, dir(C_END), rD);
  }
}

interface Star { x: number; y: number; r: number; a: number; tw: number }
interface Debris { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number }

export function Sky({ sim, stage }: { sim: Simulation; stage: RefObject<HTMLDivElement> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext("2d")!;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const stars: Star[] = Array.from({ length: 240 }, () => ({ x: rnd(), y: rnd(), r: rnd() < 0.08 ? 1.3 : 0.4 + rnd() * 0.6, a: 0.2 + rnd() * 0.55, tw: rnd() * TAU }));
    let debris: Debris[] = [], boomAt = 0, lastLost = false;
    let raf = 0, w = 0, h = 0, dpr = 1, prevT = 0;
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); };
    resize(); window.addEventListener("resize", resize);

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - prevT) / 1000 || 0); prevT = t;
      if (cv.clientWidth !== w || cv.clientHeight !== h) resize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#050607"; ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(t / 900 + s.tw));
        ctx.fillStyle = "#e6ebf0"; ctx.fillRect(s.x * w, s.y * h, s.r * 1.4, s.r * 1.4);
      }
      ctx.globalAlpha = 1;

      const m = sim.mission, route = m.route, starts = phaseStarts(route);
      nrhoRoute = route.some((p) => p.shape === "nrho");
      const cr = cv.getBoundingClientRect(), sr = stage.current?.getBoundingClientRect();
      const x = sr ? sr.left - cr.left : 0, y = sr ? sr.top - cr.top : 0, sw = sr?.width || w, sh = sr?.height || h;
      const rE = Math.max(30, Math.min(sh * 0.15, sw * 0.085));
      const rD = m.dest === "mars" ? rE * 0.42 : rE * 0.32;
      const g: Geo = { E: [x + sw * 0.17, y + sh * 0.64], rE, D: [x + sw * 0.82, y + sh * 0.3], rD, rL: rE * 1.3, rS: rE * 1.62, rDO: Math.max(rD * 2.1, 16), dest: m.dest };

      // Earth: flat disc with a thin limb, no colour fades
      const [ex, ey] = g.E;
      ctx.fillStyle = "#123a63"; ctx.beginPath(); ctx.arc(ex, ey, rE, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, rE, 0, TAU); ctx.clip();
      ctx.fillStyle = "#1d5a8f"; ctx.beginPath(); ctx.arc(ex - rE * 0.35, ey - rE * 0.35, rE * 0.95, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(5,6,7,0.55)"; ctx.beginPath(); ctx.arc(ex + rE * 0.55, ey + rE * 0.55, rE * 1.05, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(140,190,240,0.55)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(ex, ey, rE + 1.5, 0, TAU); ctx.stroke();

      // destination body
      const [dx, dy] = g.D;
      if (m.dest !== "station") {
        ctx.fillStyle = m.dest === "mars" ? "#a4472a" : "#8a9099"; ctx.beginPath(); ctx.arc(dx, dy, rD, 0, TAU); ctx.fill();
        ctx.fillStyle = m.dest === "mars" ? "#c4643e" : "#b3b8be"; ctx.beginPath(); ctx.arc(dx - rD * 0.3, dy - rD * 0.3, rD * 0.85, 0, TAU); ctx.save(); ctx.clip(); ctx.beginPath(); ctx.arc(dx, dy, rD, 0, TAU); ctx.fill(); ctx.restore();
        ctx.fillStyle = "rgba(5,6,7,0.5)"; ctx.beginPath(); ctx.arc(dx + rD * 0.5, dy + rD * 0.5, rD * 1.02, 0, TAU); ctx.save(); ctx.beginPath(); ctx.arc(dx, dy, rD, 0, TAU); ctx.clip(); ctx.fill(); ctx.restore();
      }

      // orbit rings
      ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(150,165,180,0.2)";
      ctx.beginPath(); ctx.arc(ex, ey, m.dest === "station" ? g.rS : g.rL, 0, TAU); ctx.stroke();
      if (m.dest !== "station" && !nrhoRoute) { ctx.beginPath(); ctx.arc(dx, dy, g.rDO, 0, TAU); ctx.stroke(); }
      if (nrhoRoute) { ctx.strokeStyle = "rgba(150,165,180,0.38)"; ctx.beginPath(); for (let k = 0; k <= 80; k++) { const q = nrho(g, (k / 80) * TAU); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); }
      ctx.setLineDash([]);

      // planned route (faint) and flown route (solid accent)
      const pi = phaseIndex(route, sim.met), px = phaseProgress(route, sim.met);
      const N = 70, plan: P[] = [], flown: P[] = [];
      route.forEach((p, i) => {
        if (p.real === Infinity || p.shape === "pad") return;
        for (let k = 0; k <= N; k++) {
          const q = point(g, p.shape, k / N, starts[i], starts[i], route[i + 1]?.shape === "surface"); plan.push(q);
          if (i < pi || (i === pi && k / N <= px)) flown.push(q);
        }
      });
      ctx.setLineDash([4, 6]); ctx.strokeStyle = TRACK; ctx.lineWidth = 1.2;
      ctx.beginPath(); plan.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.setLineDash([]);
      const cur = point(g, route[pi].shape, px, sim.met, starts[pi], route[pi + 1]?.shape === "surface");
      if (flown.length > 1) {
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
        ctx.beginPath(); flown.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
      }

      // station marker
      if (m.dest === "station") {
        const sa = route[pi].shape === "docked" ? A_PH + OMEGA_ISS * (sim.met - starts[pi]) : A_PH - (1 - (route[pi].shape === "phasing" ? px : 0)) * 1.4;
        const sp = add(g.E, dir(sa), g.rS);
        ctx.save(); ctx.translate(sp[0], sp[1]); ctx.rotate(sa + Math.PI / 2);
        ctx.fillStyle = "#cfd6dc"; ctx.fillRect(-9, -1, 18, 2); ctx.fillStyle = "#3e6ea8"; ctx.fillRect(-12, -5, 4, 10); ctx.fillRect(8, -5, 4, 10); ctx.fillStyle = "#cfd6dc"; ctx.fillRect(-2, -3, 4, 6);
        ctx.restore();
      }

      // vehicle: status ring, or fire, or debris
      const f = sim.fire, lost = sim.lost;
      if (lost && !lastLost) {
        boomAt = t; debris = Array.from({ length: 70 }, () => { const a = rnd() * TAU, v = 20 + rnd() * 90; return { x: cur[0], y: cur[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: rnd() < 0.5 ? "#ff7a1a" : rnd() < 0.5 ? "#ffd166" : "#cfd6dc", s: 1 + rnd() * 2.5 }; });
      }
      lastLost = lost;
      if (lost) {
        const age = (t - boomAt) / 1000;
        if (age < 0.6) { ctx.fillStyle = `rgba(255,220,170,${0.9 * (1 - age / 0.6)})`; ctx.beginPath(); ctx.arc(cur[0], cur[1], 10 + age * 90, 0, TAU); ctx.fill(); }
        for (const d of debris) { if (d.life <= 0) continue; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.995; d.vy *= 0.995; d.life -= dt * 0.25; ctx.globalAlpha = Math.max(0, d.life); ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, d.s, d.s); }
        ctx.globalAlpha = 1;
      } else {
        const burning = f && (f.stage === "burning" || f.stage === "detected" || f.stage === "suppressed");
        const col = burning ? "#ff3b2f" : SC_HEX[sim.view.status], pulse = 0.5 + 0.5 * Math.sin(t / (burning ? 90 : 380));
        if (burning) {
          const k = Math.min(1, f!.q / 400);
          for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(255,${80 + i * 50},40,${0.5 - i * 0.14})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cur[0], cur[1], 8 + i * 6 + k * 18 + pulse * 4, 0, TAU); ctx.stroke(); }
        }
        ctx.fillStyle = "#ffffff"; ctx.fillRect(cur[0] - 3, cur[1] - 3, 6, 6);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(cur[0] - 9 - pulse * 2, cur[1] - 9 - pulse * 2, 18 + pulse * 4, 18 + pulse * 4);
      }

      // labels
      ctx.font = '600 11px "Chakra Petch", "Arial Narrow", system-ui, sans-serif';
      ctx.fillStyle = "rgba(167,177,186,0.9)"; ctx.textAlign = "center";
      ctx.fillText("EARTH", ex, ey + rE + 22);
      if (m.dest !== "station") ctx.fillText(m.dest === "mars" ? "MARS" : "MOON", dx, dy + Math.max(rD, nrhoRoute ? rD * 2 : g.rDO) + 20);
      ctx.textAlign = "left"; ctx.fillStyle = lost ? "#ff4545" : "rgba(255,122,26,0.9)";
      ctx.font = '400 12px "Share Tech Mono", ui-monospace, monospace';
      ctx.fillText(lost ? "SIGNAL LOST" : sim.veh.unit ? `${sim.veh.label.toUpperCase()} ${sim.veh.value} ${sim.veh.unit}` : sim.veh.value.toUpperCase(), cur[0] + 16, cur[1] - 12);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [sim, stage]);
  return <canvas ref={ref} className="sky" aria-hidden="true" />;
}
