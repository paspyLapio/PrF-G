"""Fire Margin API (mock-first). Run: uvicorn app.main:app --reload
Margin indicator only: not an alarm, not a certification. AI proposes, humans approve."""
from __future__ import annotations
import datetime as dt, json
from typing import Literal, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from . import model as M, explain as E, procedures as P, mlp_overlay as NN

app = FastAPI(title="Fire Margin API", version="0.3")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi import Request
from pydantic import ValidationError


@app.exception_handler(ValidationError)
async def _bad_conditions(_: Request, exc: ValidationError):
    """Conditions built inside a GET handler: out-of-range values are the caller's error (422), not a crash (500)."""
    return JSONResponse(status_code=422, content={"detail": exc.errors(include_url=False, include_context=False)})


@app.get("/health", include_in_schema=False)
def health():
    """Cheap wake-up and uptime check (the free Render plan sleeps after ~15 min idle)."""
    return {"ok": True}

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")
DISCLAIMER = ("Margin indicator only: not an alarm or certification. index = evidence coverage, not a fire probability. "
              "Numbers appear only where NASA flight evidence supports them; telemetry is simulated. AI proposes, crew decides.")
TELEMETRY = json.loads((M.DATA / "telemetry.json").read_text())
STATE = {"cursor": 0}
AUDIT: list[dict] = []


class Conditions(BaseModel):
    o2_pct: float = Field(M.LUNAR_PRESET["o2_pct"], ge=10, le=100)
    # up to 60 psia: during a simulated cabin fire the pressure climbs past normal limits (Apollo 204 ruptured at >=29 psia)
    pressure_psi: float = Field(M.LUNAR_PRESET["pressure_psi"], gt=0, le=60)
    flow_cm_s: float = Field(10.0, ge=0)
    gravity_g: float = Field(M.LUNAR_PRESET["gravity_g"], ge=0, le=1)
    flow_direction: Literal["opposed", "concurrent"] = "opposed"
    pmma_thickness_mm: float = Field(4.0, gt=0, le=50)
    pmma_sides: Literal["one", "two"] = "one"
    design_o2_pct: float = Field(34.0, ge=10, le=100)
    materials: list[str] = Field(default_factory=lambda: ["cotton_fabric", "nomex_fabric", "pmma", "silicone"])


def _check_materials(ms):
    bad = [m for m in ms if not M.known(m)]
    if bad:
        raise HTTPException(422, f"unknown materials: {bad}; valid: {list(M.MATERIALS)} or {sorted(M.E.MATERIALS)}")


def _q(c: Conditions):
    return c.model_dump(exclude={"materials"})


def _index(c: Conditions):
    _check_materials(c.materials)
    r = M.evaluate(_q(c), c.materials)
    r["why"] = {"evidence_url": "/evidence/nearest", "warning": (
        "No flight evidence for some exposed materials at these conditions: no number is given for them."
        if r["confidence"] != "supported" else None)}
    r["disclaimer"] = DISCLAIMER
    return r


@app.get("/index")
def index(o2_pct: float = 34.0, pressure_psi: float = 8.2, flow_cm_s: float = 10.0, gravity_g: float = 0.166,
          materials: str = "cotton_fabric,nomex_fabric,pmma,silicone", flow_direction: Literal["opposed", "concurrent"] = "opposed",
          pmma_thickness_mm: float = 4.0, pmma_sides: Literal["one", "two"] = "one", design_o2_pct: float = 34.0):
    return _index(Conditions(o2_pct=o2_pct, pressure_psi=pressure_psi, flow_cm_s=flow_cm_s, gravity_g=gravity_g,
                             flow_direction=flow_direction, pmma_thickness_mm=pmma_thickness_mm, pmma_sides=pmma_sides,
                             design_o2_pct=design_o2_pct, materials=[m for m in materials.split(",") if m]))


@app.get("/mlp")  # P3's neural network: firewalled second opinion, never changes status/alerts/options
def mlp(o2_pct: float = 34.0, pressure_psi: float = 8.2, flow_cm_s: float = 10.0, gravity_g: float = 0.166,
        materials: str = "cotton_fabric,nomex_fabric,pmma,silicone", pmma_thickness_mm: float = 4.0,
        pmma_sides: Literal["one", "two"] = "one"):
    if not NN.available():
        raise HTTPException(503, "MLP artifacts missing: run python3 tools/sync_mlp_artifacts.py")
    return NN.assess(o2_pct, pressure_psi, flow_cm_s, gravity_g, [m for m in materials.split(",") if m],
                     pmma_thickness_mm, pmma_sides)


@app.get("/evidence")
def evidence(investigation: Optional[str] = None, material: Optional[str] = None, outcome: Optional[str] = None):
    rows = [r for r in M.EVIDENCE if (not investigation or r["investigation"] == investigation)
            and (not material or r["material"] == material) and (not outcome or r["outcome"] == outcome)]
    return {"count": len(rows), "rows": rows, "disclaimer": DISCLAIMER}


@app.get("/evidence/nearest")  # powers the "Why this?" button
def evidence_nearest(o2_pct: float, pressure_psi: float = 8.2, flow_cm_s: float = 10.0, gravity_g: float = 0.166,
                     material: Optional[str] = None, k: int = Query(5, ge=1, le=20)):
    q = dict(o2_pct=o2_pct, pressure_psi=pressure_psi, flow_cm_s=flow_cm_s, gravity_g=gravity_g)
    conf = M.confidence(q, material) if material else (None, None)
    return {"query": q, "material": material, "confidence": conf[0], "nearest": M.nearest(q, material, k),
            "max_o2_tested_at_pressure": max((r["o2_pct"] for r in M.EVIDENCE
                                              if r["o2_pct"] is not None and r["pressure_psi"] is not None
                                              and abs(r["pressure_psi"] - pressure_psi) < 0.5), default=None)}


@app.get("/telemetry")
def telemetry(step: Optional[int] = None):
    i = STATE["cursor"] if step is None else step
    if not 0 <= i < len(TELEMETRY):
        raise HTTPException(404, f"step out of range 0..{len(TELEMETRY) - 1}")
    s = TELEMETRY[i]
    c = Conditions(o2_pct=s["o2_pct"], pressure_psi=s["pressure_psi"], flow_cm_s=s["flow_cm_s"],
                   gravity_g=s["gravity_g"], materials=s["materials_exposed"])
    res = _index(c)
    if i:
        p = TELEMETRY[i - 1]
        prev = _index(Conditions(o2_pct=p["o2_pct"], pressure_psi=p["pressure_psi"], flow_cm_s=p["flow_cm_s"],
                                 gravity_g=p["gravity_g"], materials=p["materials_exposed"]))["band"]
    else:
        prev = None
    return {"sample": s, "index": res, "band_changed": prev is not None and prev != res["band"],
            "automated_check": True, "steps_total": len(TELEMETRY)}


@app.post("/telemetry/advance")
def telemetry_advance(reset: bool = False):
    STATE["cursor"] = 0 if reset else min(STATE["cursor"] + 1, len(TELEMETRY) - 1)
    return {"cursor": STATE["cursor"]}


OPTIONS = [  # advisory only; each needs crew approval via /whatif/decision
    {"id": "A", "label": "Delay unpacking of cotton fabric", "effects": {"remove_materials": ["cotton_fabric", "cotton_jersey"]}},
    {"id": "B", "label": "Stow all fabrics", "effects": {"remove_materials": ["cotton_fabric", "cotton_jersey", "nomex_fabric", "nomex", "cotton_fiberglass", "sibal"]}},
    {"id": "C", "label": "Return oxygen to the design point (approved procedure only)", "effects": {"o2_to_design": True}},
]


class WhatIf(BaseModel):
    current: Conditions = Field(default_factory=lambda: Conditions(o2_pct=34.0))


@app.post("/whatif")
def whatif(body: WhatIf):
    base = _index(body.current)
    out = []
    for o in OPTIONS:
        c = body.current.model_copy(deep=True)
        c.materials = [m for m in c.materials if m not in o["effects"].get("remove_materials", [])]
        if o["effects"].get("o2_to_design"):
            if c.o2_pct <= c.design_o2_pct:
                continue
            c.o2_pct = c.design_o2_pct
        r = _index(c)
        out.append({**o, "projected": {"index": r["index"], "band": r["band"], "status": r["status"], "confidence": r["confidence"],
                    "limiting_material": r["limiting_material"], "reasons": r["reasons"]}, "delta": round(r["index"] - base["index"], 1),
                    "evidence_run_ids": [x for p in r["per_material"] for x in p["evidence_run_ids"]][:6],
                    "status": "proposed", "requires_human_approval": True})
    return {"baseline": {"index": base["index"], "band": base["band"], "status": base["status"], "confidence": base["confidence"],
                         "limiting_material": base["limiting_material"], "reasons": base["reasons"]}, "options": out, "disclaimer": DISCLAIMER}


class Decision(BaseModel):
    option_id: str
    decision: Literal["approve", "reject"]
    crew_member: str


@app.post("/whatif/decision")  # the only human-authorized step; logged
def decision(d: Decision):
    if d.option_id not in {o["id"] for o in OPTIONS}:
        raise HTTPException(404, "unknown option")
    rec = {"ts": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"), **d.model_dump(), "executed_by": "human"}
    AUDIT.append(rec)
    return {"recorded": rec, "audit_len": len(AUDIT)}


@app.get("/rank")
def rank(preset: Literal["lunar"] = "lunar", material: Optional[str] = None):
    q = {**M.LUNAR_PRESET}
    ranked = []
    for inv in M.INVESTIGATIONS:
        runs = [r for r in M.EVIDENCE if r["investigation"] == inv["id"] and M.comparable(r)
                and (not material or r["material"] == material)]
        if not runs:
            continue
        ds = sorted(M._dist(q, r) for r in runs)
        ranked.append({**inv, "n_runs": len(runs), "relevance": round(1 / (1 + ds[0]), 2),
                       "closest_run": min(runs, key=lambda r: M._dist(q, r))["run_id"],
                       "o2_range": [min(r["o2_pct"] for r in runs), max(r["o2_pct"] for r in runs)]})
    ranked.sort(key=lambda x: -x["relevance"])
    mats = [material] if material else list(M.MATERIALS)
    env = []
    for m in mats:
        cells = []
        for o2 in range(21, 41, 3):
            c = {**q, "o2_pct": float(o2)}
            r = M.evaluate(c, [m])
            cells.append({"o2_pct": o2, "margin": r["index"], "label": r["band"], "status": r["status"],
                          "confidence": r["confidence"]})
        env.append({"material": m, "cells": cells})
    return {"preset": {"name": "lunar", **q}, "investigations": ranked, "envelope": env, "disclaimer": DISCLAIMER}


@app.get("/explain")  # plain-language answer with cited runs
def explain(o2_pct: float = 34.0, pressure_psi: float = 8.2, flow_cm_s: float = 10.0, gravity_g: float = 0.166,
            materials: str = "cotton_fabric,nomex_fabric,pmma,silicone", from_o2_pct: Optional[float] = None):
    c = Conditions(o2_pct=o2_pct, pressure_psi=pressure_psi, flow_cm_s=flow_cm_s, gravity_g=gravity_g,
                   materials=[m for m in materials.split(",") if m])
    _check_materials(c.materials)
    return E.explain(_q(c), c.materials, None if from_o2_pct is None else {"o2_pct": from_o2_pct})


class Ask(BaseModel):
    question: str = Field(min_length=2, max_length=300)
    current: Conditions = Field(default_factory=Conditions)
    from_o2_pct: Optional[float] = None


@app.post("/ask")  # intents: why / coverage / limit / options. Never acts; proposes only.
def ask(body: Ask):
    _check_materials(body.current.materials)
    opts = whatif(WhatIf(current=body.current))["options"]
    return E.ask(body.question, _q(body.current), body.current.materials,
                 None if body.from_o2_pct is None else {"o2_pct": body.from_o2_pct}, opts)


@app.get("/procedures")
def procedures_list():
    return {"disclaimer": P.SET["disclaimer"],
            "procedures": [{k: p[k] for k in ("id", "title", "trigger", "kind", "source")} | {"steps": len(p["steps"])}
                           for p in P.SET["procedures"]]}


@app.get("/procedures/active")  # picks the procedure for the current band; shows, never runs
def procedures_active(o2_pct: float = 34.0, pressure_psi: float = 8.2, flow_cm_s: float = 10.0,
                      gravity_g: float = 0.166, materials: str = "cotton_fabric,nomex_fabric,pmma,silicone"):
    c = Conditions(o2_pct=o2_pct, pressure_psi=pressure_psi, flow_cm_s=flow_cm_s, gravity_g=gravity_g,
                   materials=[m for m in materials.split(",") if m])
    res = _index(c)
    pid = P.for_band(res["band"])
    if not pid:
        return {"band": res["band"], "status": res["status"], "index": res["index"], "procedure": None,
                "message": "All exposed materials have evidence here: routine monitoring, no procedure suggested.",
                "disclaimer": P.SET["disclaimer"]}
    out = P.render(pid, whatif(WhatIf(current=c))["options"])
    return {"band": res["band"], "status": res["status"], "index": res["index"], "confidence": res["confidence"],
            "reasons": res["reasons"], **out}


@app.get("/procedures/{pid}")
def procedure_get(pid: str):
    if pid not in P.BY_ID:
        raise HTTPException(404, "unknown procedure")
    return P.render(pid)


class StepAction(BaseModel):
    crew_member: str = Field(min_length=1, max_length=60)
    action: Literal["confirm", "skip"]
    note: Optional[str] = Field(None, max_length=200)


@app.post("/procedures/reset")
def procedures_reset():
    P.STATE.clear()
    return {"reset": True}


@app.post("/procedures/{pid}/steps/{sid}")  # human confirms or skips a step; logged
def procedure_step(pid: str, sid: str, body: StepAction):
    ts = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    rec = P.record(pid, sid, body.crew_member, body.action, ts, body.note)
    if not rec:
        raise HTTPException(404, "unknown procedure or step")
    AUDIT.append({"ts": ts, "procedure": pid, "step": sid, **body.model_dump(), "executed_by": "human"})
    return {"recorded": rec, **P.render(pid)}
