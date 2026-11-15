import { ALERT, evaluate, material, type Cabin, type Evaluation, type Item, type MatState, type Reason, type Status } from "./engine";
import { project, fmtEta, type Projection } from "./trend";
import { START_MET, SURFACE_RATE, phaseIndex, phaseStarts, vehicle, type Mission, type Vehicle } from "./mission";
import { ignite, pickItem, respond, stepFire, type Fire } from "./fire";

/** A caution left unresolved this long (simulated seconds) is followed by an ignition source (NASA designs assume one can exist). */
export const IGNITE_AFTER = 900;
import { API_URL, fetchStatus, timeoutSignal, wake, type BackendView } from "./api";

export type LogType = "caution" | "advisory" | "info" | "crew" | "declined" | "ack" | "resolved";
export type Level = "ADVISORY" | "CAUTION";
/** One crew notice (Task 3): new → acknowledged → resolved, kept in history. Acknowledging never clears the condition. */
export interface Notice { id: number; level: Level; status: Status; at: number; ack: boolean; resolvedAt: number | null; resolution?: string; title: string; what: string; why: string; evidence: string; trend: string; options: number; optionTitles: string[]; ackAt?: number }
export interface LogEntry { met: number; type: LogType; text: string }
export interface Option { id: string; title: string; detail: string; from: Status; to: Status; pctFrom: number; pctTo: number; act: () => void }
export interface MaterialView { item: Item; s: MatState }
/** What the screen shows: the local evaluation, with status and evidence replaced by the live backend when connected. */
export interface View extends Evaluation { source: "api" | "local"; materials: MaterialView[]; raw: Status; confirming: boolean }
/** Short-lived information banner (recoveries). Active notices have their own banner until acknowledged. */
export interface Toast { text: string; at: number }

/** Alert priority, not evidence order: UNVERIFIED is not "worse" than REDUCED, both are advisories. */
const RANK: Record<Status, number> = { STANDBY: 0, NOMINAL: 0, REDUCED: 1, UNVERIFIED: 1, LOW: 2 };
const HOLD_MS = 1500; // an improvement must hold this long before it is shown (no flapping on sensor noise)
export const fmtTrend = (p: Projection) => !p.ok ? `O₂ trend unavailable (${p.reason})` : `O₂ ${p.dir} ${p.b! >= 0 ? "+" : "−"}${Math.abs(p.b!).toFixed(2)} pts/min over ${p.window} min; caution point: ${fmtEta(p.caution).toLowerCase()}`;

const STATE_LABEL: Record<string, MatState["st"]> = { supported: "ok", flight_data: "near", untested: "unk", smoke_only: "smoke" };
const LAB: Record<string, string> = { supported: "Model-supported", flight_data: "Flight data", untested: "Untested here", smoke_only: "Smoke data only" };

export class Simulation {
  mission: Mission;
  met = START_MET; running = false; speed = 1; seed = 13;
  inv: Item[] = []; o2 = 0; psia = 0; u = 0; smoke = 0.02;
  drift = false; drifted = 0; o2target: number | null = null; fanFail = false; dust = 0; inhibited = false;
  decided: Record<string, boolean> = {}; log: LogEntry[] = []; last: Status | null = null; notices: Notice[] = []; proj!: Projection;
  private nid = 0; private cand: { s: Status; since: number } | null = null; private heldReasons: Reason[] = [];
  o2History: [number, number][] = []; lastPhase = -1; cargoDone = false; surfaceT: number | null = null;
  cabin: Cabin = { o2: 0, psia: 0, u: 0 }; view!: View; veh!: Vehicle; toast: Toast | null = null;
  backend: BackendView | null = null; apiState: "off" | "waking" | "live" | "offline" = API_URL ? "waking" : "off"; private apiBusy = false; private histT = 0; version = 0; private apiFails = 0; private apiT = 0;
  fire: Fire | null = null; lowSince: number | null = null;
  onAlert?: (level: Level, text: string) => void;
  onFire?: (stage: Fire["stage"]) => void;
  private subs = new Set<() => void>();

  constructor(mission: Mission) { this.mission = mission; this.reset(mission); this.wakeApi(); }

  /** Start the backend as soon as the page opens, so it is awake by the time the flight reaches orbit. */
  wakeApi() {
    if (!API_URL) return;
    this.apiState = "waking"; this.emit();
    wake().then((ok) => { if (this.apiState === "waking") { this.apiState = ok ? "live" : "offline"; this.apiFails = ok ? 0 : this.apiFails; this.emit(); } });
  }
  subscribe = (fn: () => void) => { this.subs.add(fn); return () => this.subs.delete(fn); };
  emit() { this.version++; this.subs.forEach((f) => f()); }

  reset(m: Mission) {
    this.mission = m; this.met = START_MET; this.seed = 13; this.inv = structuredClone(m.inv);
    this.o2 = m.atm.launch.o2; this.psia = m.atm.launch.psia; this.u = m.u; this.smoke = 0.02;
    Object.assign(this, { drift: false, drifted: 0, o2target: null, fanFail: false, dust: 0, inhibited: false, decided: {}, log: [], last: null, notices: [], cand: null, heldReasons: [], o2History: [], lastPhase: -1, cargoDone: false, surfaceT: null, toast: null, backend: null, fire: null, lowSince: null });
    this.add("info", `Mission configured: ${m.name}`);
    this.sample();
  }

  get phase() { return this.mission.route[phaseIndex(this.mission.route, this.met)]; }
  get phaseIdx() { return phaseIndex(this.mission.route, this.met); }
  get fireActive() { const s = this.fire?.stage; return s === "burning" || s === "detected" || s === "suppressed"; }
  get lost() { return this.fire?.stage === "lost"; }
  get design() { return this.mission.atm[this.phase.atm]; }
  add(type: LogType, text: string) { this.log.unshift({ met: this.met, type, text }); if (this.log.length > 80) this.log.pop(); }
  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  private gauss() { return Math.sqrt(-2 * Math.log(this.rnd() + 1e-9)) * Math.cos(2 * Math.PI * this.rnd()); }

  step(dt: number) {
    if (this.lost) return;
    const route = this.mission.route, p = this.phase, rate = p.real === Infinity ? SURFACE_RATE : p.real / p.demo;
    // during a fire the clock runs in real time, so the crew's response window is real seconds
    const dm = this.fireActive ? dt * this.speed : dt * rate * this.speed;
    this.met += dm;
    const ni = phaseIndex(route, this.met), np = route[ni];
    if (ni !== this.lastPhase) {
      if (this.lastPhase >= 0) this.add("info", `Phase: ${np.name}`);
      this.lastPhase = ni;
      if (np.real === Infinity && this.surfaceT == null) { this.surfaceT = phaseStarts(route)[ni]; this.add("info", `Arrived: ${np.name}`); }
    }
    const dz = this.design, k = Math.min(1, dm / (np.shape === "transfer" ? 40000 : 500)), ko = this.o2target != null ? Math.min(1, dm / 120) : k;
    if (this.drift) this.drifted = Math.min(4, this.drifted + (0.24 * dm) / 60);
    const target = this.o2target ?? dz.o2;
    this.o2 += (target + (this.drift ? this.drifted : 0) - this.o2) * ko;
    if (this.fire && this.fireActive) {
      const f = this.fire, was = f.stage;
      stepFire(f, dt * this.speed);
      this.psia = f.p0 + f.dp;
      if (f.stage !== was) this.fireStage(f);
    } else this.psia += (dz.psia - this.psia) * k;
    if (this.o2target != null && Math.abs(this.o2 - this.o2target) < 0.05) this.o2target = null;
    this.u = this.fanFail ? Math.max(0.4, this.u - (2.5 * dm) / 60) : this.u + (this.mission.u - this.u) * Math.min(1, dm / 120);
    if (this.dust > 0) { this.dust -= dm; this.smoke = 0.05 + Math.abs(this.gauss()) * 0.08; if (this.dust <= 0) { this.inhibited = false; this.smoke = 0.02; this.add("info", "Dust work ended: smoke detectors re-armed"); } }
    // an unresolved caution is followed by an ignition source; fixing it (not just acknowledging) resets the clock
    if (!this.fire && this.phase.g !== "1g" && this.view?.status === "LOW") {
      this.lowSince ??= this.met;
      if (this.met - this.lowSince >= IGNITE_AFTER) this.igniteNow("an ignition source (electrical short) after the caution stayed unresolved");
    } else if (this.view?.status !== "LOW") this.lowSince = null;
    if (this.surfaceT != null && !this.fire) {
      const st = this.met - this.surfaceT;
      if (st >= 300 && !this.decided.autodrift) { this.decided.autodrift = true; this.inject("drift"); }
      if (st >= 1080 && !this.cargoDone) this.inject("cargo");
    }
    this.sample();
  }

  sample() {
    this.veh = vehicle(this.mission, this.met);
    this.cabin = { o2: this.o2 + this.gauss() * 0.03, psia: this.psia + this.gauss() * 0.006, u: Math.max(0, this.u + this.gauss() * 0.22) };
    const now = performance.now(); if (now - this.histT > 250 || !this.o2History.length) { this.histT = now; this.o2History.push([this.met, this.cabin.o2]); if (this.o2History.length > 400) this.o2History.shift(); }
    const local = evaluate(this.inv, this.cabin, this.design, this.phase.g, this.mission.band);
    if (this.lost) { this.view = { ...local, source: "local", materials: local.states, raw: local.status, confirming: false }; return; }
    this.confirm(this.merge(local));
    const v = this.view, dz = this.design;
    this.proj = project(this.o2History, this.met, this.mission.trendMin ?? 8, { label: `Caution point (design + ${this.mission.band} pt)`, o2: dz.o2 + this.mission.band },
      v.weakest && v.g !== "1g" ? { label: `Tested edge · ${v.weakest.label}`, o2: v.weakest.o2 } : null, this.cabin.o2);
    this.alerts();
    this.pollApi();
  }

  get active() { return this.notices.find((n) => n.resolvedAt == null); }

  /** Worsening is shown at once; an improvement must persist for HOLD_MS before the status (and any alert) changes. */
  private confirm(m: View) {
    const prev = this.last, raw = m.status;
    let shown = raw;
    if (prev && raw !== prev && prev !== "STANDBY" && raw !== "STANDBY" && RANK[raw] <= RANK[prev]) {
      const now = performance.now();
      if (!this.cand || this.cand.s !== raw) this.cand = { s: raw, since: now };
      if (now - this.cand.since < HOLD_MS) shown = prev;
    }
    if (shown === raw) { this.cand = null; this.heldReasons = m.reasons; this.view = m; }
    else this.view = { ...m, status: shown, reasons: this.heldReasons, confirming: true };
  }

  private merge(e: Evaluation): View {
    const b = this.backend;
    const materials = e.states.map(({ item, s }) => ({ item, s }));
    if (!b || this.apiState !== "live" || e.g === "1g") return { ...e, source: "local", materials, raw: e.status, confirming: false };
    const mats = materials.map(({ item, s }) => {
      const bm = b.materials.find((m) => m.key === item.key);
      return bm ? { item, s: { ...s, st: STATE_LABEL[bm.state] ?? s.st, lab: LAB[bm.state] ?? s.lab, txt: bm.detail, runs: bm.runs.length ? bm.runs : s.runs } } : { item, s };
    });
    return { ...e, status: b.status, pct: b.pct, head: b.head, reasons: b.reasons.map((t, i) => ({ k: "api" + i, t: t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".") })), spread: b.spread ?? e.spread, source: "api", materials: mats, raw: b.status, confirming: false };
  }

  private pollApi() {
    if (!API_URL || this.apiBusy || this.apiState === "waking" || this.phase.g === "1g") return;
    // poll every 1.5 s while live; back off to 5 s while offline, and recover on the first answer
    const now = performance.now(); if (now - this.apiT < (this.apiState === "live" ? 1500 : 5000)) return;
    this.apiT = now; this.apiBusy = true;
    const { signal, done } = timeoutSignal(8000);
    fetchStatus(this.cabin, this.design.o2, this.phase.gval, this.inv, signal)
      .then((b) => { this.backend = b; this.apiState = "live"; this.apiFails = 0; })
      .catch(() => { this.apiFails++; if (this.apiFails >= 3) { this.apiState = "offline"; this.backend = null; } })
      .finally(() => { done(); this.apiBusy = false; });
  }

  private notice(s: Status, level: Level): Notice {
    const v = this.view, c = v.cabin, w = v.weakest;
    const ev = `${v.covered} of ${v.burnable} exposed materials have NASA test evidence here` +
      (w && v.head != null ? (v.head < 0 ? `; cabin O₂ is outside the tested range for ${w.label} (${w.o2.toFixed(1)}%)` : `; ${v.head.toFixed(1)} pts below the tested edge for ${w.label}`) : "");
    return { id: ++this.nid, level, status: s, at: this.met, ack: false, resolvedAt: null, title: `Fire margin ${s}`,
      what: `Cabin ${c.o2.toFixed(1)}% O₂ (design ${this.design.o2}%) · ${c.psia.toFixed(1)} psia · ${c.u.toFixed(1)} cm/s`,
      why: v.reasons[0]?.t ?? "", evidence: ev, trend: fmtTrend(this.proj), ...((o) => ({ options: o.length, optionTitles: o.map((x) => x.title) }))(this.options()) };
  }

  /** Task 3 rules: a notice only on a confirmed status change, never per telemetry update; priority from the alert level. */
  private alerts() {
    const s = this.view.status, prev = this.last;
    if (s === prev) return;
    this.last = s;
    if (prev === null) return;
    const lvl = ALERT[s], plvl = ALERT[prev], act = this.active;
    if (act) { act.resolvedAt = this.met; act.resolution = lvl ? `Superseded by ${s}` : `Recovered to ${s}`; }
    if (!lvl) {
      if (plvl) {
        const t = `${plvl === "CAUTION" ? "Caution" : "Advisory"} cleared after confirmed recovery. Fire margin ${s.toLowerCase()}: ${this.view.reasons[0]?.t ?? ""}`;
        this.add("resolved", t); this.toast = { text: t, at: performance.now() };
      } else this.add("info", `Fire margin ${s.toLowerCase()}`);
      return;
    }
    const n = this.notice(s, lvl), down = RANK[s] < RANK[prev];
    if (down) {
      n.ack = !!act?.ack;
      this.add("resolved", `Caution cleared after confirmed recovery; ${lvl.toLowerCase()} remains (${s})`);
      this.toast = { text: `Caution cleared. Fire margin ${s.toLowerCase()}: ${n.why}`, at: performance.now() };
    } else {
      this.add(lvl === "CAUTION" ? "caution" : "advisory", `${RANK[s] > RANK[prev] && plvl ? "Escalated to " : ""}${lvl}: ${n.title}. ${n.why}`);
      this.onAlert?.(lvl, `Fire margin ${s.toLowerCase()}. ${n.why}`);
    }
    this.notices.unshift(n);
  }

  igniteNow(why: string) {
    if (this.fire || this.phase.g === "1g") return;
    const pick = pickItem(this.view.materials);
    if (!pick) { this.add("info", "Ignition source: no exposed burnable material"); return; }
    const m = this.mission;
    this.fire = ignite(pick.item, pick.s, this.view.status === "LOW", this.met, this.psia, m.volume, m.burst, this.inhibited);
    this.speed = 1;
    if (this.fire.stage === "selfext") this.add("resolved", `Ignition at ${pick.item.label}: no sustained flame, consistent with NASA test evidence (${pick.s.txt})`);
    else this.add("caution", `Ignition: ${why}. ${pick.item.label} is burning (${this.fire.regime})`);
    this.onFire?.(this.fire.stage); this.emit();
  }
  private fireStage(f: Fire) {
    if (f.stage === "detected") this.add("caution", `Vehicle smoke detectors alarm${f.inhibited ? " late (they were inhibited for dust work)" : ""}. FIRE: vehicle caution & warning has the lead`);
    if (f.stage === "out") this.add("resolved", `Fire out after the vehicle fire response. Peak cabin pressure ${(f.p0 + Math.max(...f.history.map((h) => h.psia - f.p0), f.dp)).toFixed(1)} psia`);
    if (f.stage === "lost") { this.running = false; this.add("caution", f.cause === "pressure" ? `LOSS OF VEHICLE: cabin pressure reached ${f.burst} psia` : `LOSS OF CREW: CO above the NASA 1-hour limit`); }
    this.onFire?.(f.stage); this.emit();
  }
  respondFire() {
    if (!this.fire || this.fire.stage !== "detected") return;
    respond(this.fire); this.add("crew", "Crew executed the vehicle fire response (vehicle procedure; PrF-G does not define it)"); this.emit();
  }

  inject(ev: "drift" | "cargo" | "dust" | "fan" | "ignition") {
    if (ev === "ignition") { this.igniteNow("an ignition source (electrical short)"); return; }
    if (ev === "drift" && !this.drift) { this.drift = true; this.o2target = null; this.add("info", "Event: O₂ supply valve drifting high"); }
    if (ev === "cargo") { const c = this.inv.find((i) => i.stow && !i.exposed); this.cargoDone = true; if (c) { c.exposed = true; this.add("info", `Event: cargo unpacked, ${c.label} exposed`); } }
    if (ev === "dust") { this.dust = 900; if (this.mission.det === "inhibit") { this.inhibited = true; this.add("info", "Event: dust-generating work, smoke detectors inhibited"); } else this.add("info", "Event: dust-generating work"); }
    if (ev === "fan") { this.fanFail = true; this.add("info", "Event: cabin fan stopped"); }
    this.sample(); this.emit();
  }

  options(): Option[] {
    const v = this.view; if (v.g === "1g" || this.fireActive || this.lost) return [];
    const dz = this.design, out: Option[] = [];
    const what = (fn: (inv: Item[], c: Cabin) => void) => { const inv = structuredClone(this.inv), c = { ...this.cabin }; fn(inv, c); return evaluate(inv, c, dz, v.g, this.mission.band); };
    if (v.over && this.o2target == null) {
      const p = what((_, c) => { c.o2 = dz.o2; });
      out.push({ id: "o2-" + Math.floor(this.met / 1800), title: `Return O₂ to the ${dz.o2.toFixed(1)}% design point`, detail: "Through the approved procedure, with Mission Control. PrF-G never changes the atmosphere itself.", from: v.status, to: p.status, pctFrom: v.pct, pctTo: p.pct, act: () => { this.o2target = dz.o2; this.drift = false; this.drifted = 0; } });
    }
    this.inv.forEach((it, ix) => {
      if (!it.exposed || !it.stow) return;
      const s = v.materials.find((x) => x.item === it)?.s; if (!s || s.st !== "unk") return;
      const p = what((inv) => { inv[ix].exposed = false; });
      out.push({ id: "stow-" + ix, title: `Stow ${it.label}`, detail: `${material(it.key)?.name ?? it.key}: ${s.txt}.`, from: v.status, to: p.status, pctFrom: v.pct, pctTo: p.pct, act: () => { it.exposed = false; } });
    });
    if (v.cabin.u < 5 && this.fanFail) {
      const p = what((_, c) => { c.u = this.mission.u; });
      out.push({ id: "fan", title: `Restore ventilation to ${this.mission.u} cm/s`, detail: "Below 5 cm/s, BASS-II flames were most flow-sensitive. Less airflow is not automatically safer.", from: v.status, to: p.status, pctFrom: v.pct, pctTo: p.pct, act: () => { this.fanFail = false; } });
    }
    return out.filter((o) => !this.decided[o.id] && (o.to !== o.from || o.pctTo !== o.pctFrom));
  }
  decide(o: Option, approve: boolean) {
    this.decided[o.id] = true;
    if (approve) { o.act(); this.add("crew", "Approved: " + o.title); } else this.add("declined", "Declined: " + o.title);
    this.sample(); this.emit();
  }
  /** Acknowledge = seen. The notice stays active until its condition is resolved. */
  acknowledge() { const n = this.active; if (n && !n.ack) { n.ack = true; n.ackAt = this.met; this.add("ack", `Acknowledged ${n.level.toLowerCase()}: ${n.title}`); this.emit(); } }

  jump(i: number) {
    let guard = 0;
    const route = this.mission.route, starts = phaseStarts(route);
    while (phaseIndex(route, this.met) < i && guard++ < 600 && !this.fire) {
      const pi = phaseIndex(route, this.met), p = route[pi];
      this.step(Math.max(0.05, Math.min(1, (starts[pi + 1] + 1 - this.met) / ((p.real / p.demo) * this.speed))));
    }
    this.emit();
  }
}

export function fmtMET(m: number) {
  const s = Math.abs(Math.round(m)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60, p = (n: number) => String(n).padStart(2, "0");
  return (m < 0 ? "T−" : "T+") + (d ? d + "d " : "") + p(h) + ":" + p(mi) + ":" + p(se);
}
