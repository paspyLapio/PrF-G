"""SI layer: plain-language explanations grounded in the model output + evidence table.
Deterministic templates (no LLM): every sentence carries the run_ids it rests on.
Margin indicator only; it never recommends an action on its own and never suggests an O2 or pressure setting.
(Ported from the team's v0.1 explain.py onto the v0.3 evidence model.)"""
from __future__ import annotations
from . import model as M

OUTCOME = {"spread_sustained": "the flame kept spreading", "no_sustained_flame": "no sustained flame",
           "flash_ignition_no_sustained_flame": "flash ignition, no sustained flame",
           "burned_spread_not_recorded": "it burned (spread rate not recorded)", "burned_completely": "it burned completely",
           "burned_outcome_not_stated": "it burned (final outcome not stated in the source)",
           "pmma_burned_locally_nomex_no_spread": "PMMA burned locally; Nomex did not spread",
           "burned_locally_spread_not_available": "it burned locally (spread not available)",
           "not_yet_transcribed": "outcome not yet transcribed from the source",
           "burned_no_appreciable_spread": "it ignited and kept burning but did not spread appreciably",
           "burned_to_end_of_drop_0g_limit_test": "it kept burning to the end of the ~5 s drop (0g limit test)",
           "extinguished_in_drop_0g_limit_test": "it went out within the ~5 s drop (0g limit test)"}
CAVEAT = "This is a margin indicator, not an alarm or a certification. Any action needs crew approval."
_ROW = {r["run_id"]: r for r in M.EVIDENCE}


def _g(g):
    return "microgravity" if g == 0 else "1 g" if g == 1 else "gravity not stated" if g is None else f"{g} g"


def _v(x, unit, fmt="{:g}"):
    return (fmt.format(x) + unit) if x is not None else f"? {unit.strip()} (not reported)"


def describe_run(r):
    res = OUTCOME.get(r["outcome"], r["outcome"])
    if r.get("spread_rate_mm_s") is not None:
        res += f", {r['spread_rate_mm_s']:g} mm/s"
    flag = "" if r.get("verified") else " [unverified]"
    return (f"{r['run_id']} ({r['material_as_reported']}, {_v(r['o2_pct'], '% O2')}, {_v(r['pressure_kpa'], ' kPa')}, "
            f"{_v(r['flow_cm_s'], ' cm/s')}, {_g(r['gravity_g'])}): {res}{flag}")


def _s(text, run_ids=None):
    return {"text": text, "run_ids": [r for r in (run_ids or []) if r in _ROW]}


def _pack(intent, s, extra=None):
    ids = sorted({r for x in s for r in x["run_ids"]})
    return {"intent": intent, "answer": " ".join(x["text"] for x in s), "sentences": s, "cited_run_ids": ids,
            "cited_runs": [_ROW[r] for r in ids], **(extra or {})}


def _provenance(ids):
    bad = [r for r in ids if not _ROW[r].get("verified")]
    return _s(f"Note: {len(bad)} cited run(s) are not fully verified against the source ({', '.join(bad)}).", bad) if bad else None


def _headline(res, q):
    lim = res["limiting_material"]
    t = (f"Status {res['status']} (band {res['band']}; evidence coverage {res['index']:g}%) at {q['o2_pct']:g}% O2, "
         f"{q['pressure_psi']:g} psia, {q['flow_cm_s']:g} cm/s, {_g(q['gravity_g'])}.")
    if lim:
        t += f" Weakest tested material: {M.label(lim)}."
    return t


def explain(q, materials, ref=None):
    """Explain the status at q. ref = earlier conditions to explain a change from (default: lunar preset)."""
    res = M.evaluate(q, materials)
    out = [_s(_headline(res, q))]
    for p in res["per_material"]:
        out.append(_s(f"{p['label']}: {p['detail']}", p["evidence_run_ids"][:3]))
    if res["predicted_spread"]:
        pr = res["predicted_spread"]
        out.append(_s(f"PMMA prediction: {pr['spread_mm_s']} mm/s (likely {pr['likely_range_mm_s'][0]}-{pr['likely_range_mm_s'][1]}), "
                      f"{pr['model']}, held-out typical error {pr['heldout_typical_error']}."))
    out.append(_s("Why: " + "; ".join(res["reasons"]) + "."))
    if ref is not None:
        r0 = M.evaluate({**q, **ref}, materials)
        new = [x for x in res["reasons"] if x not in r0["reasons"]]
        if r0["status"] != res["status"] or new:
            out.append(_s(f"Compared with {ref.get('o2_pct', q['o2_pct']):g}% O2: status {r0['status']} -> {res['status']}, "
                          f"coverage {r0['index']:g}% -> {res['index']:g}%." + (" New: " + "; ".join(new) + "." if new else "")))
        else:
            out.append(_s(f"Compared with {ref.get('o2_pct', q['o2_pct']):g}% O2: no change in status or reasons."))
    p = _provenance(sorted({r for x in out for r in x["run_ids"]}))
    if p:
        out.append(p)
    out.append(_s(CAVEAT))
    return _pack("why", out, {"result": {"index": res["index"], "band": res["band"], "status": res["status"],
                                          "confidence": res["confidence"]}})


def evidence_ceiling(materials):
    """Highest O2 with a flight result (sustained or not) per material: where the evidence stops. Not a limit."""
    rows = []
    for m in materials:
        st = M.E.material_state(m, M._full(M.LUNAR_PRESET))
        fam = st["family"]
        runs = [r for r in M.EVIDENCE if fam and r["material_family"] == fam and r["o2_pct"] is not None and r["sustained"] is not None]
        top = max(runs, key=lambda r: r["o2_pct"]) if runs else None
        rows.append((m, top))
    return rows


def ask(question, q, materials, ref=None, options=None):
    t = question.lower()
    if any(w in t for w in ("why", "drop", "driver", "chang", "what happened")):
        return explain(q, materials, ref)
    if any(w in t for w in ("tested", "evidence", "trust", "sure", "confiden", "data")):
        res = M.evaluate(q, materials)
        s = [_s(f"Confidence is {res['confidence']}: {res['coverage_pct']}% of exposed burnable materials have flight evidence here.")]
        for p in res["per_material"]:
            near = M.nearest(q, p["material"], 1)
            s.append(_s(f"{p['label']}: {p['state'].replace('_', ' ')}"
                        + (f"; closest run {describe_run(near[0])}." if near else "; no run with transcribed conditions."),
                        [near[0]["run_id"]] if near else []))
        p = _provenance(sorted({r for x in s for r in x["run_ids"]}))
        return _pack("coverage", s + ([p] if p else []) + [_s(CAVEAT)])
    if any(w in t for w in ("limit", "maximum", "max", "how high", "highest", "safe o2", "raise")):
        s = [_s("I do not give an oxygen setting: cabin O2 and pressure limits come from approved procedures. "
                "What I can say is how far the NASA microgravity evidence goes:")]
        for m, top in evidence_ceiling(materials):
            s.append(_s(f"{M.label(m)}: highest O2 with a microgravity test result is {top['o2_pct']:g}% ({describe_run(top)}; {top.get('hardware') or 'platform not stated'})."
                        if top else f"{M.label(m)}: no microgravity run with transcribed O2.", [top["run_id"]] if top else []))
        s.append(_s(f"Current cabin O2 is {q['o2_pct']:g}%; above a material's evidence ceiling the app gives no number."))
        return _pack("limit", s + [_s(CAVEAT)])
    if options and any(w in t for w in ("option", "what can", "what should", "what if", "we do", "action", "recommend", "suggest", "fix", "reduce")):
        s = [_s("Options for the crew to consider (none is applied until a crew member approves):")]
        for o in options:
            pj = o["projected"]
            s.append(_s(f"Option {o['id']}: {o['label']}. Status would be {pj['status']} (coverage {pj['index']:g}%, {o['delta']:+g}).",
                        o["evidence_run_ids"][:3]))
        return _pack("options", s + [_s(CAVEAT)])
    return {"intent": "unknown", "answer": "I can answer: why the status is what it is or changed, how well these conditions "
            "are tested, how far the flight evidence goes in O2, or what options exist.", "sentences": [],
            "cited_run_ids": [], "cited_runs": []}
