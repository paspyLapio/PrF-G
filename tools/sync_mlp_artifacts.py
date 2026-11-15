"""Copy P3's MLP artifacts into the API and build per-material input templates.

Run after retraining material_intelligence:   python3 tools/sync_mlp_artifacts.py
Writes api/data/mlp/{mlp_weights.npz, preprocessor.json, classes.json, templates.json}.
Templates hold the test-geometry features of each material family (median numbers, most common
categories) from material_intelligence/data/runs.csv; the API swaps in the live cabin O2, pressure
and airflow. No pickle anywhere: weights are a NumPy archive, the rest is JSON.
"""
import csv, json, shutil, statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DST = ROOT / "material_intelligence", ROOT / "api" / "data" / "mlp"
GEOMETRY_NUM = ["thickness_mm", "heated_thickness_mm", "width_cm", "areal_density_kg_m2"]
GEOMETRY_CAT = ["material", "material_family", "geometry_class", "o2_basis", "pressure_source", "flow_config"]

def num(x):
    try: return float(x)
    except (TypeError, ValueError): return None

DST.mkdir(parents=True, exist_ok=True)
for f in ("mlp_weights.npz", "preprocessor.json", "classes.json"):
    shutil.copy2(SRC / "artifacts" / f, DST / f)

rows = defaultdict(list)
for r in csv.DictReader(open(SRC / "data" / "runs.csv", encoding="utf-8")):
    rows[r["material_family"]].append(r)
templates = {}
for fam, rs in rows.items():
    t = {"n_training_rows": len(rs)}
    for c in GEOMETRY_NUM:
        vals = [v for v in (num(r[c]) for r in rs) if v is not None]
        t[c] = statistics.median(vals) if vals else None
    for c in GEOMETRY_CAT:
        vals = [r[c] if r[c] != "" else "UNKNOWN" for r in rs]
        t[c] = Counter(vals).most_common(1)[0][0]
    templates[fam] = t
json.dump(templates, open(DST / "templates.json", "w"), indent=2)
print(f"api/data/mlp: weights, preprocessor, classes, templates for {len(templates)} families")
