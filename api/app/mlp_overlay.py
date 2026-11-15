"""P3's neural network as a firewalled second opinion (GET /mlp).

Loads the artifacts trained in material_intelligence/ (copied to api/data/mlp by tools/sync_mlp_artifacts.py):
NumPy weights (allow_pickle=False) and JSON preprocessing state. The forward pass and preprocessing
reproduce material_intelligence/mlp.py and preprocessing.py with NumPy only, so the API needs no pandas
or scikit-learn. tests: api/test_api.py checks this against P3's own code.

Firewall: nothing in engine.py or model.py imports this module. Its output never changes status,
alerts or crew options; the front end shows it beside the evidence engine, labelled as a second opinion.
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np

DIR = Path(__file__).resolve().parent.parent / "data" / "mlp"
KPA_PER_PSI = 6.89476
NUMERIC = ["thickness_mm", "heated_thickness_mm", "width_cm", "burning_sides", "areal_density_kg_m2",
           "o2_initial_pct", "pressure_kpa", "pressure_series_range_kpa", "flow_cms", "gravity"]
CATEGORICAL = ["material", "material_family", "geometry_class", "o2_basis", "pressure_source", "flow_config"]
# front-end material keys -> training material families (same mapping as frontend/src/lib/engine.ts FAM)
FAMILY = {"sibal": "sibal_fabric", "cotton_jersey": "cotton_fabric", "cotton_fabric": "cotton_fabric", "pmma": "pmma",
          "pmma_structured": "pmma_structured", "nomex": "nomex_fabric", "nomex_fabric": "nomex_fabric",
          "silicone": "silicone", "nomex_ht90_40": "nomex_ht90_fabric", "ultem_1000": "ultem_film", "mylar_g": "mylar_film"}
# In the training CSV these columns are text ("one", "micro") or empty, so the fitted model saw one constant
# value. We pass that same value; gravity is checked separately because the model never saw anything but micro.
CONSTANT_IN_TRAINING = {"burning_sides": 0.0, "pressure_series_range_kpa": 0.0, "gravity": 0.0}

_state: dict | None = None


def available() -> bool:
    return all((DIR / f).exists() for f in ("mlp_weights.npz", "preprocessor.json", "classes.json", "templates.json"))


def _load() -> dict:
    global _state
    if _state is None:
        with np.load(DIR / "mlp_weights.npz", allow_pickle=False) as d:
            w = {k: d[k].copy() for k in ("W1", "b1", "W2", "b2")}
        pre = json.loads((DIR / "preprocessor.json").read_text())
        classes = json.loads((DIR / "classes.json").read_text())
        if w["W2"].shape[1] != len(classes):
            raise ValueError("classes.json does not match the model output size")
        _state = {"w": w, "pre": pre, "classes": classes, "templates": json.loads((DIR / "templates.json").read_text())}
    return _state


def _vector(rec: dict, pre: dict) -> np.ndarray:
    num = []
    for c in NUMERIC:
        v = rec.get(c)
        v = pre["numeric_medians"][c] if v is None else float(v)
        num.append((v - pre["numeric_means"][c]) / pre["numeric_stds"][c])
    active = {f"{c}_{rec.get(c) if rec.get(c) is not None else 'UNKNOWN'}" for c in CATEGORICAL}  # pandas get_dummies names
    onehot = [1.0 if col in active else 0.0 for col in pre["category_columns"]]
    return np.asarray(num + onehot, dtype=float)[None, :]


def _forward(x: np.ndarray, w: dict) -> np.ndarray:
    h = 1.0 / (1.0 + np.exp(-np.clip(x @ w["W1"] + w["b1"], -500, 500)))
    z = h @ w["W2"] + w["b2"]
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return (e / e.sum(axis=1, keepdims=True))[0]


def _domain(rec: dict, pre: dict, gravity_g: float, z_limit: float = 3.0) -> list[str]:
    issues = []
    for c in ("o2_initial_pct", "pressure_kpa", "flow_cms", "thickness_mm", "heated_thickness_mm"):
        v = rec.get(c)
        if v is None:
            continue
        z = (float(v) - pre["numeric_means"][c]) / pre["numeric_stds"][c]
        lo, hi = pre["numeric_min"][c], pre["numeric_max"][c]
        if abs(z) > z_limit or not (lo <= float(v) <= hi):
            issues.append(f"{c} = {float(v):g} is outside the training range {lo:g}–{hi:g}")
    if gravity_g > 0.01:
        issues.append("trained on microgravity tests only; no partial- or 1 g training data")
    return issues


def assess(o2_pct: float, pressure_psi: float, flow_cm_s: float, gravity_g: float, materials: list[str],
           pmma_thickness_mm: float | None = None, pmma_sides: str = "one") -> dict:
    s = _load()
    pre, classes, tpl = s["pre"], s["classes"], s["templates"]
    out = []
    for key in materials:
        fam = FAMILY.get(key, key)
        t = tpl.get(fam)
        if t is None:
            out.append({"material": key, "family": None, "in_domain": False, "scores": None, "predicted": None,
                        "issues": ["no training data for this material"]})
            continue
        rec = {**{c: t.get(c) for c in NUMERIC + CATEGORICAL if c in t}, **CONSTANT_IN_TRAINING,
               "o2_initial_pct": o2_pct, "pressure_kpa": pressure_psi * KPA_PER_PSI, "flow_cms": flow_cm_s}
        if fam == "pmma" and pmma_thickness_mm:
            rec["thickness_mm"] = pmma_thickness_mm
            rec["heated_thickness_mm"] = pmma_thickness_mm / 2 if pmma_sides == "two" else pmma_thickness_mm
        p = _forward(_vector(rec, pre), s["w"])
        issues = _domain(rec, pre, gravity_g)
        out.append({"material": key, "family": fam, "training_rows": t.get("n_training_rows"),
                    "scores": {c: round(float(v), 3) for c, v in zip(classes, p)},
                    "predicted": classes[int(np.argmax(p))], "in_domain": not issues, "issues": issues})
    return {
        "model": "P3 MLP: sustained burning yes/no (16 hidden units, trained on NASA runs, grouped CV)",
        "target": "sustained", "classes": classes, "per_material": out,
        "firewall": "Second opinion only. Never changes status, alerts or crew options.",
        "note": "Scores are uncalibrated softmax outputs, not fire probabilities. Outside the training domain they are shown but flagged.",
    }
