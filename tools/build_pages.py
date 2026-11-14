"""Build the two published pages from the frozen data (one source of truth).
  app/mission_template.html -> app/mission.html      (full-screen mission demo + PrF-G dashboard)
  app/prfg_template.html    -> app/crew_screen.html  (single crew screen + mission setup)
Data: data/runs.csv, data/materials.csv, data/investigations.csv, data/gp_pmma.json,
      data/page_reference.json (atmospheres, screening bands, certification note)."""
import csv, json, re
from pathlib import Path
H = Path(__file__).resolve().parent.parent
D_ = H / "data"

def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None

runs = []
inv_url = {i["investigation"]: i["source_url"] for i in csv.DictReader(open(D_ / "investigations.csv"))}
for r in csv.DictReader(open(D_ / "runs.csv")):
    url = re.search(r"https?://\S+", r["source"])
    runs.append({"inv": r["investigation"], "id": r["test_id"], "seg": int(r["segment"]) if r["segment"] else 1,
                 "mat": r["material"], "fam": r["material_family"], "t": f(r["thickness_mm"]), "o2": f(r["o2_mean_pct"]),
                 "p": f(r["pressure_kpa"]), "u": f(r["flow_cms"]), "cfg": r["flow_config"], "out": r["outcome"],
                 "sus": r["sustained"], "v": f(r["spread_rate_mm_s"]), "q": r["data_quality"],
                 "srcurl": url.group(0).rstrip(").,;") if url else inv_url.get(r["investigation"]) or None})
mats = [{"key": m["material_key"], "name": m["material_name"], "fam": m["family"], "comp": m["composition"],
         "cat": m["evidence_category"], "catm": m["evidence_category_meaning"], "inv": m["investigations"],
         "ev": m["evidence_measured"], "note": m["notes"]} for m in csv.DictReader(open(D_ / "materials.csv"))]
inv = list(csv.DictReader(open(D_ / "investigations.csv")))
ref = json.load(open(D_ / "page_reference.json"))
D = {"runs": runs, "inv": inv, "mats": mats, **ref}
GP = json.load(open(D_ / "gp_pmma.json"))
dj, gj = json.dumps(D, separators=(",", ":")), json.dumps(GP, separators=(",", ":"))
for src, out in (("mission_template.html", "mission.html"), ("prfg_template.html", "crew_screen.html")):
    t = (H / "app" / src).read_text()
    assert "__DATA__" in t and "__GP__" in t, src
    (H / "app" / out).write_text(t.replace("__DATA__", dj).replace("__GP__", gj))
    print(out, "built:", len(runs), "runs,", len(mats), "materials,", len(inv), "investigations")
