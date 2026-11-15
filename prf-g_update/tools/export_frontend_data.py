"""Export the evidence base for the React front end (frontend/src/data/evidence.json).
Same source files as the backend and the HTML pages: data/runs.csv, materials.csv, page_reference.json, gp_pmma.json."""
import csv, json, re
from pathlib import Path
H = Path(__file__).resolve().parent.parent
D = H / "data"
def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None
inv_url = {i["investigation"]: i["source_url"] for i in csv.DictReader(open(D / "investigations.csv"))}
runs = []
for r in csv.DictReader(open(D / "runs.csv")):
    url = re.search(r"https?://\S+", r["source"])
    runs.append({"inv": r["investigation"], "id": r["test_id"], "seg": int(r["segment"]) if r["segment"] else 1,
                 "fam": r["material_family"], "o2": f(r["o2_mean_pct"]), "p": f(r["pressure_kpa"]), "u": f(r["flow_cms"]),
                 "out": r["outcome"], "sus": r["sustained"], "v": f(r["spread_rate_mm_s"]),
                 "src": url.group(0).rstrip(").,;") if url else inv_url.get(r["investigation"]) or None})
mats = [{"key": m["material_key"], "name": m["material_name"], "cat": m["evidence_category"], "inv": m["investigations"],
         "ev": m["evidence_measured"]} for m in csv.DictReader(open(D / "materials.csv"))]
ref = json.load(open(next(p for p in (D / "page_reference.json", H / "app" / "page_reference.json") if p.exists())))
out = {"runs": runs, "mats": mats, "bands": ref["bands"], "gp": json.load(open(next(p for p in (D / "gp_pmma.json", H / "models" / "gp" / "gp_pmma.json") if p.exists())))}
dest = H / "frontend" / "src" / "data" / "evidence.json"
dest.parent.mkdir(parents=True, exist_ok=True)
json.dump(out, open(dest, "w"), separators=(",", ":"))
print(f"{dest.relative_to(H)}: {len(runs)} runs, {len(mats)} materials")
