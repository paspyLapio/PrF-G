"""Fire Safety Margin v0.2: evidence model.

Every number traces to a real flight run (data/evidence.json) or to the PMMA Gaussian
process fitted on those runs (data/gp_pmma.json). Outside that evidence the model
returns no number: it says "untested" and reports how far conditions are from the data.

Indicator parts:
  coverage_pct     share of exposed burnable materials with flight evidence here
  o2_headroom_pts  highest flight-tested O2 of the weakest material minus cabin O2
  predicted_spread GP spread rate, PMMA slabs only, inside the model domain
  status           Nominal / Reduced / Unverified / Low, with reasons
"""
from __future__ import annotations

import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
EVIDENCE: list[dict] = json.loads((DATA / "evidence.json").read_text())
INVESTIGATIONS: list[dict] = json.loads((DATA / "investigations.json").read_text())
MATERIALS: dict[str, dict] = json.loads((DATA / "engine_materials.json").read_text())  # 29 materials, evidence categories A/B/C
ATMOSPHERES: list[dict] = json.loads((DATA / "atmospheres.json").read_text())
BANDS: list[dict] = json.loads((DATA / "screening_bands.json").read_text())
GP: dict = json.loads((DATA / "gp_pmma.json").read_text())

PSI_TO_KPA = 6.89476
ALIASES = {"cotton_fabric": "cotton_jersey", "cotton_fiberglass": "sibal", "nomex_fabric": "nomex"}  # old mock keys
LUNAR_PRESET = {"o2_pct": 34.0, "pressure_psi": 8.2, "flow_cm_s": 10.0, "gravity_g": 0.166, "design_o2_pct": 34.0}
ISS_PRESET = {"o2_pct": 21.0, "pressure_psi": 14.5, "flow_cm_s": 10.0, "gravity_g": 0.0, "design_o2_pct": 21.0}
PRESETS = {"lunar": LUNAR_PRESET, "iss": ISS_PRESET}

# PMMA Gaussian process validity domain (BASS-II M1-M20, opposed flow, microgravity)
GP_DOMAIN = {"heated_thickness_mm": (0.5, 5.0), "o2_pct": (17.0, 22.5), "flow_cm_s": (2.0, 21.0), "pressure_kpa": (97.0, 103.0)}


def resolve(material: str) -> str:
    return ALIASES.get(material, material)


def gravity_case(g: float) -> str:
    if g <= 0.01:
        return "micro"
    if g >= 0.99:
        return "1g"
    return "partial"


def runs_of(family: str | None) -> list[dict]:
    return [r for r in EVIDENCE if family and r["material_family"] == family]


def max_o2_tested(family: str | None) -> float | None:
    xs = [r["o2_pct"] for r in runs_of(family) if r["o2_pct"] is not None and r["sustained"] is not None]
    return max(xs) if xs else None


def screening(o2: float, psia: float, flow: float) -> dict:
    def pick(param, v):
        rows = [b for b in BANDS if b["parameter"] == param]
        for b in rows:
            if float(b["from"]) <= v < float(b["to"]):
                return {"value": v, "class": b["screening_class"], "meaning": b["interpretation"]}
        b = rows[-1]
        return {"value": v, "class": b["screening_class"], "meaning": b["interpretation"]}
    return {"o2": pick("o2_pct", o2), "pressure": pick("pressure_psia", psia), "airflow": pick("airflow_cms", flow),
            "note": "App screening classification from NASA design points, not an official NASA scale."}


# ---------------- Gaussian process (pure Python, matches scikit-learn exactly) ----------------
def gp_predict(heated_thickness_mm: float, o2_pct: float) -> tuple[float, float]:
    z = [(math.log(heated_thickness_mm) - GP["mu"][0]) / GP["sd"][0], (o2_pct - GP["mu"][1]) / GP["sd"][1]]
    k = [GP["c"] * math.exp(-0.5 * (((r[0] - z[0]) / GP["ls"][0]) ** 2 + ((r[1] - z[1]) / GP["ls"][1]) ** 2)) for r in GP["Z"]]
    mean = sum(ki * ai for ki, ai in zip(k, GP["alpha"]))
    quad = sum(k[i] * sum(GP["Kinv"][i][j] * k[j] for j in range(len(k))) for i in range(len(k)))
    mu = GP["ym"] + GP["ys"] * mean
    sd = math.sqrt(max(0.0, GP["c"] - quad + GP["noise"])) * GP["ys"]
    return mu, sd


def pmma_prediction(q: dict) -> dict:
    te = q["pmma_thickness_mm"] / 2 if q["pmma_sides"] == "two" else q["pmma_thickness_mm"]
    vals = {"heated_thickness_mm": te, "o2_pct": q["o2_pct"], "flow_cm_s": q["flow_cm_s"], "pressure_kpa": q["pressure_psi"] * PSI_TO_KPA}
    why = [k for k, (lo, hi) in GP_DOMAIN.items() if not lo <= vals[k] <= hi]
    if q["flow_direction"] != "opposed":
        why.append("flow_direction")
    if gravity_case(q["gravity_g"]) != "micro":
        why.append("gravity")
    if why:
        return {"ok": False, "outside": why}
    mu, sd = gp_predict(te, q["o2_pct"])
    return {"ok": True, "spread_mm_s": round(math.exp(mu), 4), "likely_range_mm_s": [round(math.exp(mu - sd), 4), round(math.exp(mu + sd), 4)],
            "model": "Gaussian process, 39 BASS-II segments / 18 PMMA slab tests", "heldout_typical_error": f"x{GP['err']:.2f}"}


# ---------------- evidence search ----------------
def distance(q: dict, r: dict) -> float:
    pk = q["pressure_psi"] * PSI_TO_KPA
    d = ((r["o2_pct"] - q["o2_pct"]) / 3.0) ** 2
    d += (((r["flow_cm_s"] if r["flow_cm_s"] is not None else q["flow_cm_s"]) - q["flow_cm_s"]) / 10.0) ** 2
    d += ((r["pressure_kpa"] - pk) / 20.0) ** 2 if r["pressure_kpa"] is not None else 0.25
    return math.sqrt(d)


def nearest(q: dict, material: str | None = None, k: int = 5) -> list[dict]:
    fam = MATERIALS[resolve(material)]["family"] if material else None
    rows = [r for r in EVIDENCE if r["o2_pct"] is not None and (material is None or r["material_family"] == fam)]
    return [{**r, "distance": round(distance(q, r), 2)} for r in sorted(rows, key=lambda r: distance(q, r))[:k]]


def material_state(material: str, q: dict) -> dict:
    key = resolve(material)
    m = MATERIALS[key]
    fam, g = m["family"], gravity_case(q["gravity_g"])
    base = {"material": key, "label": m["label"], "evidence_category": m["evidence_category"], "family": fam,
            "max_o2_tested": max_o2_tested(fam), "runs": len(runs_of(fam)), "evidence_run_ids": [], "burnable": m["evidence_category"] != "B"}
    if m["evidence_category"] == "C":
        return {**base, "state": "untested", "detail": "Flown on spacecraft; no microgravity burn or smoke test found."}
    if m["evidence_category"] == "B":
        return {**base, "state": "smoke_only", "detail": f"Smoke data only ({m['investigations']}): {m['evidence_measured']}."}
    if fam is None:
        return {**base, "state": "untested", "detail": f"Burned in {m['investigations']}; run values not yet transcribed."}
    if key == "pmma":
        pr = pmma_prediction(q)
        if pr["ok"]:
            return {**base, "state": "supported", "prediction": pr, "evidence_run_ids": [r["run_id"] for r in nearest(q, key, 3)],
                    "detail": f"Predicted spread {pr['spread_mm_s']} mm/s (likely {pr['likely_range_mm_s'][0]}-{pr['likely_range_mm_s'][1]})."}
    if key == "nomex":
        ids = [r["run_id"] for r in runs_of(fam)]
        if g == "micro" and q["o2_pct"] <= 23:
            return {**base, "state": "flight_data", "evidence_run_ids": ids,
                    "detail": "No sustained flame in 3 of 3 BASS-II tests at station-air oxygen or lower (exact O2 not transcribed)."}
        return {**base, "state": "untested", "evidence_run_ids": ids,
                "detail": "No flame in 3 of 3 BASS-II tests, but only at station-air oxygen or lower."}
    near = nearest(q, key, 1)
    if near and near[0]["distance"] <= 1.2 and g == "micro":
        r = near[0]
        res = f"spread {r['spread_rate_mm_s']} mm/s" if r["spread_rate_mm_s"] is not None else r["outcome"]
        return {**base, "state": "flight_data", "evidence_run_ids": [r["run_id"]], "detail": f"Nearest flight run {r['run_id']} at {r['o2_pct']}% O2: {res}."}
    mx = base["max_o2_tested"]
    return {**base, "state": "untested", "evidence_run_ids": [r["run_id"] for r in near],
            "detail": (f"Flight data only up to {mx}% O2." if mx is not None else "No transcribed conditions.")
            + (" No partial-gravity data in PSI; microgravity and 1g act as bounds." if g == "partial" else "")}


def evaluate(q: dict, materials: list[str]) -> dict:
    per = [material_state(m, q) for m in materials]
    burn = [p for p in per if p["burnable"]]
    covered = [p for p in burn if p["state"] in ("supported", "flight_data")]
    coverage = round(100 * len(covered) / len(burn)) if burn else 100
    tested = [(p["max_o2_tested"], p["material"]) for p in burn if p["max_o2_tested"] is not None and p["material"] != "nomex"]
    weakest = min(tested) if tested else None
    headroom = round(weakest[0] - q["o2_pct"], 1) if weakest else None
    sc = screening(q["o2_pct"], q["pressure_psi"], q["flow_cm_s"])
    lvl = {"reference": 0, "check_design": 0, "elevated": 1, "high": 2, "outside_reference": 3}.get(sc["o2"]["class"], 1)
    over_design = q["o2_pct"] > q["design_o2_pct"] + 1
    if lvl >= 3 or (over_design and coverage < 50):
        status = "Low"
    elif burn and coverage == 0:
        status = "Unverified"
    elif coverage < 100 or lvl >= 2 or (headroom is not None and headroom < 0) or sc["airflow"]["class"] == "sensitive":
        status = "Reduced"
    else:
        status = "Nominal"
    reasons = []
    if over_design:
        reasons.append(f"oxygen {q['o2_pct'] - q['design_o2_pct']:.1f} points above the {q['design_o2_pct']}% design point")
    reasons.append(f"{len(covered)} of {len(burn)} exposed burnable materials have flight evidence here")
    if headroom is not None and headroom < 0:
        reasons.append(f"cabin oxygen is {-headroom} points above the highest flight-tested oxygen for {MATERIALS[weakest[1]]['label']}")
    if sc["airflow"]["class"] == "sensitive":
        reasons.append("airflow in the 0-5 cm/s range where BASS-II flames were most flow-sensitive")
    pm = next((p for p in per if p.get("prediction")), None)
    confidence = "supported" if burn and coverage == 100 else "untested" if coverage == 0 else "partial"
    return {"status": status, "coverage_pct": coverage, "o2_headroom_pts": headroom,
            "weakest_material": weakest[1] if weakest else None,
            "predicted_spread": pm["prediction"] if pm else None, "confidence": confidence,
            "reasons": reasons, "screening": sc, "per_material": per, "conditions": q,
            "gravity_case": gravity_case(q["gravity_g"])}
