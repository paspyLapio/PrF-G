/* Singularities · PrF-G showcase: hero singularity, scroll reveals and the per-section animations. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------------------------------------------ Lenis smooth scrolling (off for reduced motion) */
  const lenis = !reduce && window.Lenis
    ? new window.Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.95, anchors: { offset: 0, duration: 1.6 } })
    : null;
  window.lenis = lenis; // handy for debugging in the console

  // Hero parallax: title lifts and fades, the singularity sinks and grows as you leave the hero.
  const heroEl = document.querySelector(".hero");
  const parallax = (y) => {
    const p = Math.max(0, Math.min(1, y / (heroEl.offsetHeight || innerHeight)));
    heroEl.style.setProperty("--p", p.toFixed(4));
  };
  if (lenis) lenis.on("scroll", (l) => parallax(l.scroll));
  else if (!reduce) addEventListener("scroll", () => parallax(scrollY), { passive: true });

  /* ------------------------------------------------------------ nav: scrolled state + active section */
  const onScroll = () => document.body.classList.toggle("scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  const secs = $$("[data-sec]");
  const active = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      const id = e.target.dataset.sec;
      document.body.dataset.active = id;
      $$(".top .links a").forEach((a) => a.classList.toggle("on", a.dataset.for === id));
    }
  }, { rootMargin: "-50% 0px -50% 0px" });
  secs.forEach((s) => active.observe(s));

  /* ------------------------------------------------------------ reveal: each section gets .in once, then runs its intro */
  const intros = { repo: repoIntro, demo: demoIntro, presentation: presIntro };
  const reveal = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      e.target.classList.add("in");
      reveal.unobserve(e.target);
      intros[e.target.dataset.sec]?.();
    }
  }, { threshold: 0.22 });
  secs.forEach((s) => (s.dataset.sec === "hero" ? s.classList.add("in") : reveal.observe(s)));
  $$(".hero .reveal").forEach((el, i) => setTimeout(() => el.classList.add("in"), 150 + i * 160));

  /* ------------------------------------------------------------ count-up numbers */
  function countUp(root) {
    $$("[data-count]", root).forEach((el) => {
      const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 3));
        el.textContent = v.toFixed(dec);
        if (k < 1 && !reduce) requestAnimationFrame(step); else el.textContent = to.toFixed(dec);
      };
      requestAnimationFrame(step);
    });
  }

  /* ------------------------------------------------------------ shared: repo + presentation info from the Worker */
  const info = fetch("/presentation/info").then((r) => (r.ok ? r.json() : null)).catch(() => null);

  /* ============================================================ HERO: the singularity */
  (function hole() {
    const cv = $("#hole"), ctx = cv.getContext("2d");
    let w = 0, h = 0, dpr = 1, R = 0, cx = 0, cy = 0, mx = 0, my = 0, tx = 0, ty = 0, run = true, last = 0;
    const N = innerWidth < 700 ? 420 : 900;
    const P = [];
    const spawn = (p, far) => {
      p.r = R * (far ? 2.2 + Math.random() * 3.2 : 1.25 + Math.random() * 4.2);
      p.a = Math.random() * Math.PI * 2;
      p.w = 0.6 + Math.random() * 1.6; // brightness
      p.z = (Math.random() - 0.5) * 0.18; // disk thickness
      return p;
    };
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(w, h) * (w < 700 ? 0.15 : 0.13);
      cx = w / 2; cy = h * 0.45;
      if (!P.length) for (let i = 0; i < N; i++) P.push(spawn({}, false));
    }
    size(); addEventListener("resize", () => { size(); if (!run || reduce) requestAnimationFrame(frame); });
    addEventListener("pointermove", (e) => { tx = (e.clientX / w - 0.5) * 30; ty = (e.clientY / h - 0.5) * 20; }, { passive: true });

    const TILT = 0.28; // accretion disk seen almost edge-on
    const col = (r) => {
      const k = Math.max(0, Math.min(1, (r - R) / (R * 4.5)));
      // inner: white-hot / amber, outer: violet
      const hue = 30 + k * 230, light = 88 - k * 30, sat = 100 - k * 20;
      return `hsl(${hue} ${sat}% ${light}%`;
    };
    function drawParticles(dt, back) {
      for (const p of P) {
        const behind = Math.sin(p.a) < 0;
        if (behind !== back) continue;
        const a0 = p.a;
        if (dt) {
          p.a += dt * 0.55 * Math.pow(R / p.r, 1.5);
          p.r -= dt * R * 0.035 * (R * 2 / p.r);
          if (p.r < R * 1.02) spawn(p, true);
        }
        const x0 = cx + Math.cos(a0) * p.r, y0 = cy + Math.sin(a0) * p.r * TILT + p.z * p.r;
        const x1 = cx + Math.cos(p.a) * p.r, y1 = cy + Math.sin(p.a) * p.r * TILT + p.z * p.r;
        const near = Math.max(0, 1 - (p.r - R) / (R * 4));
        ctx.strokeStyle = col(p.r) + ` / ${0.25 + near * 0.6 * p.w})`;
        ctx.lineWidth = 0.6 + near * 1.6;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + (x1 - x0) * 2, y1 + (y1 - y0) * 2); ctx.stroke();
      }
    }
    function frame(t) {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
      mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
      cx = w / 2 + mx; cy = h * 0.45 + my;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      // outer halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 5);
      halo.addColorStop(0, "rgba(255,170,90,.22)"); halo.addColorStop(0.25, "rgba(143,110,255,.12)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
      drawParticles(reduce ? 0 : dt, true);
      // lensed ring of the far side of the disk, bent over the top of the hole
      ctx.lineWidth = R * 0.07;
      const lens = ctx.createLinearGradient(cx - R * 1.4, 0, cx + R * 1.4, 0);
      lens.addColorStop(0, "rgba(143,110,255,0)"); lens.addColorStop(0.5, "rgba(255,200,140,.75)"); lens.addColorStop(1, "rgba(143,110,255,0)");
      ctx.strokeStyle = lens; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.28, R * 1.18, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      // event horizon + photon ring
      ctx.globalCompositeOperation = "source-over";
      const ph = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.12);
      ph.addColorStop(0, "rgba(0,0,0,1)"); ph.addColorStop(0.45, "rgba(255,226,190,.95)"); ph.addColorStop(1, "rgba(255,150,70,0)");
      ctx.fillStyle = ph; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      drawParticles(reduce ? 0 : dt, false);
      ctx.globalCompositeOperation = "source-over";
      if (run && !reduce) requestAnimationFrame(frame);
    }
    new IntersectionObserver(([e]) => {
      const was = run; run = e.isIntersecting;
      if (run && !was && !reduce) { last = 0; requestAnimationFrame(frame); }
    }).observe($(".hero"));
    requestAnimationFrame(frame);
  })();

  /* ============================================================ 01 REPO: terminal + live commits */
  async function repoIntro() {
    countUp($("#repo"));
    const term = $("#term");
    const lines = [
      ["p", "$ ", "git clone github.com/paspyLapio/PrF-G && cd PrF-G"],
      ["d", "", "Receiving objects: 100% · evidence base, models, api, frontend"],
      ["p", "$ ", "python3 api/test_api.py http://localhost:8000"],
      ["bar"],
      ["ok", "", "46 / 46 checks passed"],
      ["p", "$ ", "curl \"localhost:8000/index?o2_pct=24.1&gravity_g=0&materials=pmma\""],
      ["d", "", "{ \"index\": 100.0, \"band\": \"safe\", \"status\": \"Nominal\", \"confidence\": \"supported\", \"limiting_material\": \"pmma\" }"],
    ];
    if (reduce) {
      term.innerHTML = lines.map(([c, p, t]) => (c === "bar" ? "[████████████████████] 46/46" : `<span class="${c}">${p}${t ?? ""}</span>`)).join("\n");
    } else {
      term.innerHTML = "";
      for (const [cls, prompt, text] of lines) {
        const line = document.createElement("span");
        term.appendChild(line);
        const cur = document.createElement("span"); cur.className = "cur";
        if (cls === "bar") {
          for (let i = 0; i <= 20; i++) {
            line.textContent = `[${"█".repeat(i)}${"·".repeat(20 - i)}] ${Math.round(i * 2.3)}/46`;
            line.after(cur); await wait(45); cur.remove();
          }
        } else if (cls === "p") {
          line.innerHTML = `<span class="p">${prompt}</span>`;
          const body = document.createElement("span"); line.appendChild(body);
          for (const ch of text) { body.textContent += ch; line.after(cur); await wait(18 + Math.random() * 26); cur.remove(); }
          await wait(260);
        } else {
          line.className = cls; line.textContent = text; await wait(220);
        }
        term.appendChild(document.createTextNode("\n"));
      }
      const cur = document.createElement("span"); cur.className = "cur"; term.appendChild(cur);
    }

    // Latest commits straight from GitHub (public API; silently skipped if rate-limited).
    const d = await info;
    const m = (d?.repoUrl ?? "https://github.com/paspyLapio/PrF-G").match(/github\.com\/([^/]+\/[^/]+)/);
    if (!m) return;
    try {
      const r = await fetch(`https://api.github.com/repos/${m[1]}/commits?per_page=3`);
      if (!r.ok) return;
      const cs = await r.json();
      $("#commits").innerHTML = `<div>latest commits</div>` + cs.map((c) => {
        const msg = (c.commit?.message ?? "").split("\n")[0].replace(/[<>&]/g, (x) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[x]);
        return `<a href="${c.html_url}" target="_blank" rel="noopener"><span>${c.sha.slice(0, 7)}</span><span>${msg}</span></a>`;
      }).join("");
    } catch { /* offline or rate-limited: keep the static tree */ }
  }

  /* ============================================================ 02 DEMO: looping mini mission */
  function demoIntro() {
    const path = $("#path"), craft = $("#craft"), L = path.getTotalLength();
    const met = $("#met"), ring = $("#ringbox"), rfg = $("#rfg"), st = $("#rstate"), toast = $("#toast");
    const o2 = $("#o2"), psi = $("#psi"), flow = $("#flow"), spark = $("#spark");
    const C = 201, CYCLE = 14000, hist = [];
    let t0 = performance.now(), visible = true, lastPush = 0;

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(tick); }).observe($("#demo"));

    const pad = (n) => String(Math.floor(n)).padStart(2, "0");
    function tick(t) {
      const k = ((t - t0) % CYCLE) / CYCLE;
      // craft along the trajectory (first 75% of the cycle), parked at the Moon after
      const along = Math.min(1, k / 0.75);
      const p = path.getPointAtLength(L * (1 - Math.pow(1 - along, 2)));
      craft.setAttribute("transform", `translate(${p.x} ${p.y})`);
      // mission clock: compress ~4 days into the cycle
      const s = k * 96 * 3600;
      met.textContent = `T+${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}`;
      // cabin: O2 drifts up after 35%, pressure eases down, airflow dips (a fan slowdown)
      const drift = Math.max(0, (k - 0.35) / 0.45);
      const ox = 20.9 + Math.min(1, drift) * 3.2 + Math.sin(t / 700) * 0.04;
      const ps = 14.7 - Math.min(1, drift) * 4.5 + Math.sin(t / 900) * 0.02;
      const fl = 10.1 - Math.min(1, drift) * 4.2 + Math.sin(t / 500) * 0.15;
      o2.textContent = ox.toFixed(2); psi.textContent = ps.toFixed(2); flow.textContent = fl.toFixed(1);
      o2.classList.toggle("up", ox > 23);
      // status ring
      let state = "STANDBY", fill = 0, cls = "";
      if (k > 0.12) { state = "NOMINAL"; fill = 0.86; cls = "nominal"; }
      if (ox > 23.4) { state = "CAUTION"; fill = 0.48; cls = "caution"; }
      if (st.textContent !== state) { st.textContent = state; ring.className = "ringbox " + cls; rfg.style.strokeDashoffset = String(C * (1 - fill)); }
      toast.classList.toggle("show", state === "CAUTION");
      // sparkline
      if (t - lastPush > 120) {
        lastPush = t; hist.push(ox); if (hist.length > 60) hist.shift();
        const lo = 20.6, hi = 24.4;
        spark.setAttribute("points", hist.map((v, i) => `${(i / 59) * 200},${40 - ((v - lo) / (hi - lo)) * 36 - 2}`).join(" "));
        if (k < 0.01) hist.length = 0;
      }
      if (visible && !reduce) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ============================================================ 03 PRESENTATION: deck fan + gauge + live deck status */
  async function presIntro() {
    const g = $("#gval"), t0 = performance.now();
    const step = (t) => {
      const k = Math.max(0, Math.min(1, (t - t0 - 1000) / 2000));
      g.textContent = Math.round(72 * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && !reduce) requestAnimationFrame(step); else if (reduce) g.textContent = "72";
    };
    requestAnimationFrame(step);

    const box = $("#deckstate"), label = $("span", box), d = await info;
    if (!d) { label.textContent = "Deck status unavailable right now"; return; }
    if (d.kind === "pdf" || d.kind === "pptx") {
      box.className = "deckstate reveal in ready"; label.textContent = `Deck ready · ${d.name}`; $("#dl").hidden = false;
    } else if (d.kind === "link") {
      box.className = "deckstate reveal in ready"; label.textContent = `Deck ready · ${new URL(d.url).hostname}`;
    } else {
      box.className = "deckstate reveal in soon"; label.textContent = "Deck coming soon";
    }
  }
})();
