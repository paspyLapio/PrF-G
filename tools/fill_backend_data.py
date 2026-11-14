"""Fill fire-margin-api/data/*.json with the team's real, sourced data (from halo/data/*.csv).
Nothing is invented: a value missing from the source stays null and is flagged."""
import csv, json, re, sys
from pathlib import Path
OUT = Path(sys.argv[1]) / "data"
D = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "data"  # folder with runs.csv, investigations.csv, materials.csv
KPA_PER_PSI = 6.894757
runs = list(csv.DictReader(open(D / "runs.csv")))
invs = list(csv.DictReader(open(D / "investigations.csv")))
mats = {m["material_key"]: m for m in csv.DictReader(open(D / "materials.csv"))}
inv_url = {i["investigation"]: i["source_url"] for i in invs}

def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None
KEY = {"pmma": "pmma", "pmma_structured": "pmma_structured", "composite": "pmma_nomex_composite",
       "sibal_fabric": "cotton_fiberglass", "cotton_fabric": "cotton_fabric", "nomex_fabric": "nomex_fabric",
       "silicone": "silicone", "nomex_ht90_fabric": "nomex_ht90_40", "ultem_film": "ultem_1000", "mylar_film": "mylar_g"}
OUTCOME = {"spread": "spread_sustained", "burned, spread not recorded": "burned_spread_not_recorded",
           "burned completely": "burned_completely", "flash ignition, no sustained flame": "flash_ignition_no_sustained_flame",
           "no sustained flame": "no_sustained_flame", "burned, final outcome not stated": "burned_outcome_not_stated",
           "PMMA burned locally; Nomex no spread": "pmma_burned_locally_nomex_no_spread",
           "burned locally, spread not available": "burned_locally_spread_not_available",
           "not yet transcribed": "not_yet_transcribed",
           "burned, no appreciable spread": "burned_no_appreciable_spread",
           "burned to end of 5 s drop (0g limit test)": "burned_to_end_of_drop_0g_limit_test",
           "extinguished in 5 s drop (0g limit test)": "extinguished_in_drop_0g_limit_test"}
ev = []
for r in runs:
    url = re.search(r"https?://\S+", r["source"])
    url = url.group(0).rstrip(").,") if url else inv_url.get(r["investigation"]) or None
    p = f(r["pressure_kpa"]); dq = r["data_quality"]
    verified = dq.startswith("measured") and r["outcome"] != "not yet transcribed"
    ev.append({
        "run_id": f'{r["investigation"]}:{r["test_id"]}' + (f'-s{r["segment"]}' if r["segment"] and sum(x["test_id"] == r["test_id"] and x["investigation"] == r["investigation"] for x in runs) > 1 else ""),
        "investigation": r["investigation"], "test_id": r["test_id"], "segment": r["segment"] or None,
        "material": KEY.get(r["material_family"], r["material_family"]), "material_as_reported": r["material"],
        "thickness_mm": f(r["thickness_mm"]), "burning_sides": r["burning_sides"] or None,
        "o2_pct": f(r["o2_mean_pct"]), "o2_basis": r["o2_basis"] or None,
        "o2_initial_pct": f(r["o2_initial_pct"]), "o2_final_pct": f(r["o2_final_pct"]),
        "pressure_psi": round(p / KPA_PER_PSI, 2) if p is not None else None, "pressure_kpa": p,
        "pressure_source": r["pressure_source"],
        "flow_cm_s": f(r["flow_cms"]), "flow_config": r["flow_config"] or None,
        "gravity_g": 0 if r["gravity"] == "micro" else 1 if r["gravity"] == "1g" else None,
        "outcome": OUTCOME.get(r["outcome"], r["outcome"]), "sustained": {"yes": True, "no": False}.get(r["sustained"]),
        "spread_rate_mm_s": f(r["spread_rate_mm_s"]), "hardware": r["hardware"] or None,
        "source_title": (r["source"].split(" http")[0] if not r["source"].startswith("http") else "Saffire SIBAL/cotton flame spread paper (UCL Discovery)"), "source_link": url,
        "data_quality": dq, "verified": verified,
        "verification_note": None if verified else ("outcome not yet transcribed from source" if r["outcome"] == "not yet transcribed" else dq),
        "notes": r["notes"] or None,
        # fields read by app/engine.py (v0.2 evidence model)
        "material_family": r["material_family"], "heated_thickness_mm": f(r["heated_thickness_mm"]),
        "flow_direction": r["flow_config"] or None, "gravity": r["gravity"] or None, "source_url": url,
    })
json.dump(ev, open(OUT / "evidence.json", "w"), indent=1)

inv_out = []
have = {e["investigation"] for e in ev}
for i in invs:
    inv_out.append({"id": i["investigation"], "name": i["investigation"], "facility": i["hardware"] or None,
                    "gravity": "micro", "summary": i["key_findings"] or None, "fuels": i["fuels_or_materials"] or None,
                    "o2_range": i["o2_range"] or None, "pressure": i["pressure"] or None, "flow": i["flow"] or None,
                    "experiment_type": i["experiment_type"], "combustion_test": i["combustion_test"] == "true",
                    "source_link": i["source_url"] or None, "verified": i["verified"] == "yes",
                    "runs_in_evidence": sum(e["investigation"] == i["investigation"] for e in ev)})
for name, duct in (("Saffire-IV", "Cygnus reduced duct 109x46x30.5 cm"), ("Saffire-V", "Cygnus reduced duct 109x46x30.5 cm"),
                   ("TM-2008-215260", "NASA GRC Zero Gravity Research Facility drop rig, 5.18 s microgravity, 20 cm ID flow tunnel")):
    if name not in {x["id"] for x in inv_out} and name in have:
        rr = [e for e in ev if e["investigation"] == name]
        inv_out.append({"id": name, "name": name, "facility": duct, "gravity": "micro",
                        "summary": ("0g flammability limits of thin materials (Nomex HT90-40, Ultem 1000, Mylar G) and Kimwipes flame spread "
                                    "at exploration pressures; ~5 s drop-tower tests, conservative limits" if name.startswith("TM")
                                    else "Large-scale material flammability on Cygnus; samples: " + ", ".join(sorted({e["material_as_reported"] for e in rr}))),
                        "fuels": None, "o2_range": f'{min(e["o2_pct"] for e in rr)}-{max(e["o2_pct"] for e in rr)}%',
                        "pressure": f'{min(e["pressure_kpa"] for e in rr)}-{max(e["pressure_kpa"] for e in rr)} kPa', "flow": "30 cm/s (limit tests)" if name.startswith("TM") else "20 cm/s",
                        "experiment_type": "drop tower" if name.startswith("TM") else "flight", "combustion_test": True, "source_link": rr[0]["source_link"],
                        "verified": any(e["verified"] for e in rr), "runs_in_evidence": len(rr)})
json.dump(inv_out, open(OUT / "investigations.json", "w"), indent=1)

old = json.load(open(Path(__file__).parent / "materials_original_mock.json"))  # the 5 model materials: labels + stub weights
SRC = {"cotton_fabric": "cotton_jersey", "nomex_fabric": "nomex", "cotton_fiberglass": "sibal", "pmma": "pmma",
       "silicone": "silicone", "pmma_structured": "pmma_structured"}
LABEL = {"pmma_structured": ("Structured PMMA", "polymer")}
mo = {}
for k in list(old):  # the 5 materials the scoring model knows; structured PMMA and the PMMA+Nomex composite stay in evidence.json only
    m = mats[SRC[k]]; rr = [e for e in ev if e["material"] == k]
    burned = [e for e in rr if e["sustained"] is True]
    o2s = [e["o2_pct"] for e in rr if e["o2_pct"] is not None]
    base = old[k] if k in old else {"label": LABEL[k][0], "class": LABEL[k][1], "flammability": None}
    mo[k] = {"label": base["label"], "class": base["class"],
             "flammability": base["flammability"],
             "flammability_note": "PLACEHOLDER weight used only by the stub scoring model; not derived from PSI. Replace with the GP/v0.2 margin.",
             "name_in_sources": m["material_name"], "composition": m["composition"] or None,
             "evidence_category": m["evidence_category"], "evidence_category_meaning": m["evidence_category_meaning"],
             "investigations": m["investigations"], "evidence_measured": m["evidence_measured"] or None,
             "n_runs": len(rr), "n_sustained": len(burned), "n_not_sustained": sum(e["sustained"] is False for e in rr),
             "o2_tested_range_pct": [min(o2s), max(o2s)] if o2s else None,
             "max_o2_with_sustained_flame_pct": max((e["o2_pct"] for e in burned if e["o2_pct"] is not None), default=None),
             "notes": m["notes"] or None}
json.dump(mo, open(OUT / "materials.json", "w"), indent=1)
print(len(ev), "evidence rows,", sum(e["verified"] for e in ev), "verified;", len(inv_out), "investigations;", len(mo), "materials")

# engine material list (29+ materials, evidence categories) generated from materials.csv: one source of truth
FAMILY = {"sibal": "sibal_fabric", "cotton_jersey": "cotton_fabric", "pmma": "pmma", "pmma_structured": "pmma_structured",
          "nomex": "nomex_fabric", "nomex_ht90_40": "nomex_ht90_fabric", "silicone": "silicone",
          "ultem_1000": "ultem_film", "mylar_g": "mylar_film"}
eng = {k: {"label": m["material_name"], "family": FAMILY.get(k), "evidence_category": m["evidence_category"],
           "evidence_meaning": m["evidence_category_meaning"], "composition": m["composition"] or None,
           "investigations": m["investigations"], "evidence_measured": m["evidence_measured"] or None,
           "note": m["notes"] or None} for k, m in mats.items()}
json.dump(eng, open(OUT / "engine_materials.json", "w"), indent=1)
print(len(eng), "engine materials;", sum(v["family"] is not None for v in eng.values()), "with flight/drop runs")
