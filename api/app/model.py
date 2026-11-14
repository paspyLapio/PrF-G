"""Fire margin model: adapter from the v0.2 evidence engine (app/engine.py) to this API's response shape.

`index` is now EVIDENCE COVERAGE (0-100): the share of exposed burnable materials that have NASA flight
evidence at these conditions. It is not a probability of fire and not a NASA scale. `band` comes from the
v0.2 status rules (see STATUS_TO_BAND), not from numeric cutoffs. The PMMA spread rate comes from the
Gaussian process fitted on 39 BASS-II segments (held-out typical error x1.30), only inside its domain.
"""
from __future__ import annotations
import json, math
from pathlib import Path
from . import engine as E

DATA = Path(__file__).resolve().parent.parent / "data"
EVIDENCE = json.loads((DATA / "evidence.json").read_text())
INVESTIGATIONS = json.loads((DATA / "investigations.json").read_text())
MATERIALS = json.loads((DATA / "materials.json").read_text())

# Lunar habitat design point 34% O2 at 8.2 psia (56.5 kPa); flow and gravity are scenario values
LUNAR_PRESET = {"o2_pct": 34.0, "pressure_psi": 8.2, "flow_cm_s": 10.0, "gravity_g": 0.166}
DEFAULTS = {"flow_direction": "opposed", "pmma_thickness_mm": 4.0, "pmma_sides": "one", "design_o2_pct": 34.0}

# v0.2 status -> gauge band. TEAM DECISION: confirm with the gauge/demo script (see README).
STATUS_TO_BAND = {"Nominal": "safe", "Reduced": "tight", "Low": "critical", "Unverified": "untested"}
STATE_TO_CONF = {"supported": "supported", "flight_data": "supported", "smoke_only": "untested", "untested": "untested"}


def known(material: str) -> bool:
    return material in MATERIALS or E.resolve(material) in E.MATERIALS


def label(material: str) -> str:
    if material in MATERIALS:
        return MATERIALS[material]["label"]
    return E.MATERIALS[E.resolve(material)]["label"]


def band(status: str) -> str:
    return STATUS_TO_BAND.get(status, "untested")


def _full(q):
    return {**DEFAULTS, **{k: v for k, v in q.items() if v is not None}}


# ---- evidence support / confidence -------------------------------------------------
SCALES = {"o2_pct": 2.5, "pressure_psi": 3.0, "ln_flow": 0.8, "gravity_g": 0.4}


MISSING_PENALTY = 0.25  # squared: an unreported value counts as 0.5 scale units away (never an exact match)


def _dist(q, r):
    """Distance in scaled units. Rows without O2 cannot be compared and are excluded by `nearest`."""
    d = ((q["o2_pct"] - r["o2_pct"]) / SCALES["o2_pct"]) ** 2
    d += ((q["pressure_psi"] - r["pressure_psi"]) / SCALES["pressure_psi"]) ** 2 if r.get("pressure_psi") is not None else MISSING_PENALTY
    d += ((math.log(max(q["flow_cm_s"], .1)) - math.log(max(r["flow_cm_s"], .1))) / SCALES["ln_flow"]) ** 2 if r.get("flow_cm_s") is not None else MISSING_PENALTY
    d += ((q["gravity_g"] - r["gravity_g"]) / SCALES["gravity_g"]) ** 2 if r.get("gravity_g") is not None else MISSING_PENALTY
    return math.sqrt(d)


def comparable(r):
    return r.get("o2_pct") is not None


def nearest(q, material=None, k=5):
    rows = [r for r in EVIDENCE if comparable(r) and (material is None or r["material"] == material)]
    ranked = sorted(({**r, "distance": round(_dist(q, r), 2)} for r in rows), key=lambda r: r["distance"])
    return ranked[:k]


def confidence(q, material):
    """Per-material evidence state from the v0.2 engine, plus this API's nearest-run distance."""
    st = E.material_state(material, _full(q))
    near = nearest(q, material, k=1)
    return STATE_TO_CONF[st["state"]], (near[0]["distance"] if near else None)


def evaluate(q, materials):
    full = _full(q)
    r = E.evaluate(full, materials)
    near_d = {m: (nearest(q, m, 1) or [{"distance": None}])[0]["distance"] for m in materials}
    per = [{"material": m, "label": label(m), "margin": None, "band": p["state"],
            "confidence": STATE_TO_CONF[p["state"]], "state": p["state"], "detail": p["detail"],
            "nearest_distance": near_d[m], "max_o2_tested": p["max_o2_tested"], "breakdown": [],
            "prediction": p.get("prediction"), "evidence_run_ids": p["evidence_run_ids"]}
           for m, p in zip(materials, r["per_material"])]
    sc = r["screening"]
    breakdown = [
        {"factor": "evidence_coverage", "value": r["coverage_pct"], "unit": "%", "risk_points": None},
        {"factor": "o2_headroom", "value": r["o2_headroom_pts"], "unit": "O2 points", "risk_points": None},
        {"factor": "o2", "value": q["o2_pct"], "class": sc["o2"]["class"], "risk_points": None},
        {"factor": "pressure", "value": q["pressure_psi"], "class": sc["pressure"]["class"], "risk_points": None},
        {"factor": "airflow", "value": q["flow_cm_s"], "class": sc["airflow"]["class"], "risk_points": None},
    ]
    return {"index": float(r["coverage_pct"]), "index_meaning": "evidence coverage %: exposed burnable materials with flight evidence here",
            "band": band(r["status"]), "status": r["status"], "confidence": r["confidence"],
            "limiting_material": r["weakest_material"], "breakdown": breakdown, "per_material": per,
            "coverage_pct": r["coverage_pct"], "o2_headroom_pts": r["o2_headroom_pts"],
            "predicted_spread": r["predicted_spread"], "reasons": r["reasons"], "screening": sc,
            "gravity_case": r["gravity_case"], "conditions": full}
