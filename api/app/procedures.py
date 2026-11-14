"""Simulated crew procedure set. Steps are shown to the crew, confirmed by a human, and logged.
The system never executes a step. Not NASA flight procedures."""
from __future__ import annotations
import json
from . import model as M

SET = json.loads((M.DATA / "procedures.json").read_text())
BY_ID = {p["id"]: p for p in SET["procedures"]}
STATE: dict[str, dict[str, dict]] = {}     # procedure id -> step id -> record


def for_band(band: str):
    return {"untested": "margin_untested", "tight": "margin_tight", "critical": "margin_critical"}.get(band)


def render(pid: str, options: list | None = None):
    p = BY_ID[pid]
    opt = {o["id"]: o for o in (options or [])}
    steps = []
    for s in p["steps"]:
        rec = STATE.get(pid, {}).get(s["id"])
        item = {**s, "status": rec["status"] if rec else "pending", "record": rec,
                "requires_human_confirmation": True}
        w = opt.get(s.get("whatif_option"))
        if w:
            item["model_projection"] = {"index": w["projected"]["index"], "band": w["projected"]["band"], "status": w["projected"]["status"],
                                        "delta": w["delta"], "evidence_run_ids": w["evidence_run_ids"]}
        steps.append(item)
    done = sum(1 for x in steps if x["status"] != "pending")
    return {"procedure": {k: p[k] for k in ("id", "title", "trigger", "kind", "source")},
            "steps": steps, "progress": f"{done}/{len(steps)}", "disclaimer": SET["disclaimer"]}


def record(pid: str, sid: str, crew: str, action: str, ts: str, note: str | None):
    if pid not in BY_ID or sid not in {s["id"] for s in BY_ID[pid]["steps"]}:
        return None
    rec = {"status": "confirmed" if action == "confirm" else "skipped", "crew_member": crew,
           "ts": ts, "note": note, "executed_by": "human"}
    STATE.setdefault(pid, {})[sid] = rec
    return rec
