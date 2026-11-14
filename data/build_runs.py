"""
build_runs.py - convert raw_runs.csv (as transcribed from the sources) into runs.csv
with comparable, physics-based variables. Nothing is filled by assumption:
a derived value is only computed when every input it needs is present.

Run: python3 build_runs.py
"""
import csv
import math

P0 = 101.325                     # kPa, reference pressure
RHO_PMMA = 1190.0                # kg/m3, cast PMMA (literature value)
ALPHA_PMMA = 1.1e-7              # m2/s, thermal diffusivity of PMMA (literature value)
AREAL = {                        # kg/m2, measured areal densities (UCL Saffire paper)
    "SIBAL cotton/fiberglass": 0.1805,
    "Bleached organic interlock cotton": 0.181,
}
HARDWARE = {
    "BASS-II": "MSG, SPICE flow duct 7.6x7.6x17 cm",
    "Saffire-I": "Cygnus large duct 109x46x51 cm",
    "Saffire-II": "Cygnus large duct 109x46x51 cm",
    "Saffire-III": "Cygnus large duct 109x46x51 cm",
    "Saffire-IV": "Cygnus reduced duct 109x46x30.5 cm",
    "Saffire-V": "Cygnus reduced duct 109x46x30.5 cm",
    "TM-2008-215260": "GRC drop tower (5.18 s), 20 cm ID flow tunnel",
}
SUSTAINED = {  # outcome text -> did a flame sustain? (None = cannot tell from the source)
    "spread": "yes",
    "burned, spread not recorded": "yes",
    "burned completely": "yes",
    "flash ignition, no sustained flame": "no",
    "no sustained flame": "no",
    "burned, final outcome not stated": "",
    "PMMA burned locally; Nomex no spread": "",
    "burned locally, spread not available": "",
    "not yet transcribed": "",
    "burned, no appreciable spread": "yes",
    "burned to end of 5 s drop (0g limit test)": "yes",
    "extinguished in 5 s drop (0g limit test)": "no",
}


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def family(mat):
    m = mat.lower()
    if "pmma" in m and "nomex" in m:
        return "composite"
    if "nomex" in m and "ht90" in m:
        return "nomex_ht90_fabric"   # different grade from BASS-II Nomex III: kept separate
    if "nomex" in m:
        return "nomex_fabric"
    if "ultem" in m:
        return "ultem_film"
    if "mylar" in m:
        return "mylar_film"
    if "structured" in m and "pmma" in m:
        return "pmma_structured"
    if "pmma" in m:
        return "pmma"
    if "sibal" in m:
        return "sibal_fabric"
    if "cotton" in m:
        return "cotton_fabric"
    if "structured" in m and "pmma" in m:
        return "pmma_structured"
    if "silicone" in m:
        return "silicone"
    return "other"


def geometry_class(fam, t_mm):
    if fam in ("sibal_fabric", "cotton_fabric", "nomex_fabric", "nomex_ht90_fabric"):
        return "thin_fabric"
    if t_mm is None:
        return "unknown"
    if t_mm < 0.5:
        return "thin_film"
    if t_mm >= 8:
        return "thick_block"
    return "slab"


rows_out = []
with open("raw_runs.csv", newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        fam = family(r["material"])
        t = num(r["thickness_mm"])
        oi, of = num(r["o2_initial_pct"]), num(r["o2_final_pct"])
        o2 = (oi + of) / 2 if (oi is not None and of is not None) else oi
        p_rep, p_fl = num(r["pressure_kpa_reported"]), num(r["pressure_kpa_flight_level"])
        p = p_rep if p_rep is not None else p_fl
        p_src = "reported" if p_rep is not None else ("same flight (inference)" if p_fl is not None else "not available")
        v = num(r["spread_rate_mm_s"])
        u = num(r["flow_cms"])

        # areal density: measured for fabrics, computed from thickness for PMMA
        areal = AREAL.get(r["material"])
        if areal is None and fam == "pmma" and t is not None:
            areal = RHO_PMMA * t / 1000
        # heated thickness: two-sided burning heats each half of the sample
        t_eff = (t / 2 if r["burning_sides"] == "two" else t) if t is not None else None
        # thermal regime (PMMA only): heated half-thickness vs heat penetration depth alpha / V
        ratio = regime = ""
        if fam == "pmma" and t_eff is not None and v:
            delta_mm = ALPHA_PMMA / (v / 1000) * 1000
            ratio = round(t_eff / delta_mm, 2)
            regime = "thin" if ratio < 0.3 else "thick" if ratio > 3 else "intermediate"

        geo = geometry_class(fam, t)
        rows_out.append({
            "investigation": r["investigation"], "test_id": r["test_id"], "segment": r["segment"],
            "data_quality": r["data_quality"], "source": r["source"],
            "hardware": HARDWARE.get(r["investigation"], ""),
            "material": r["material"], "material_family": fam, "geometry_class": geo,
            "thickness_mm": t if t is not None else "", "heated_thickness_mm": t_eff if t_eff is not None else "",
            "width_cm": r["width_cm"], "burning_sides": r["burning_sides"],
            "areal_density_kg_m2": round(areal, 4) if areal else "",
            "o2_initial_pct": r["o2_initial_pct"], "o2_final_pct": r["o2_final_pct"],
            "o2_mean_pct": round(o2, 2) if o2 is not None else "",
            "o2_basis": ("estimate: mean of test initial and final O2 (per-segment O2 not reported)" if (oi is not None and of is not None) else "reported value" if oi is not None else ""),
            "o2_mole_fraction": round(o2 / 100, 4) if o2 is not None else "",
            "pressure_kpa": p if p is not None else "", "pressure_source": p_src,
            "pressure_series_range_kpa": r["pressure_series_range_kpa"],
            "ppo2_kpa": round(o2 / 100 * p, 2) if (o2 is not None and p is not None) else "",
            "o2_x_sqrt_p_ratio": round(o2 / 100 * math.sqrt(p / P0), 4) if (o2 is not None and p is not None) else "",
            "flow_cms": u if u is not None else "", "flow_config": r["flow_config"], "gravity": r["gravity"],
            "outcome": r["outcome"], "sustained": SUSTAINED.get(r["outcome"], ""),
            "spread_rate_mm_s": v if v is not None else "",
            "mass_consumption_g_per_m_s": round(v / 1000 * areal * 1000, 5) if (v and areal) else "",
            "thermal_thickness_ratio": ratio, "thermal_regime": regime,
            "comparability_class": f"{fam}|{geo}|{r['flow_config'] or 'flow_unknown'}|{r['gravity']}|{HARDWARE.get(r['investigation'], 'hardware_unknown').split(',')[0].split(' ')[0]}",
            "use_spread_model": "yes" if v else "no",
            "use_boundary_model": "yes" if (SUSTAINED.get(r["outcome"]) in ("yes", "no") and o2 is not None) else "no",
            "burn_duration_s": r["burn_duration_s"], "burn_length_cm": r["burn_length_cm"],
            "notes": r["notes"],
        })

with open("runs.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows_out[0]))
    w.writeheader()
    w.writerows(rows_out)
print(f"runs.csv: {len(rows_out)} rows")
