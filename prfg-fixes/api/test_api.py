"""Smoke test for the Fire Margin API.
Usage: python3 test_api.py http://localhost:8000
       python3 test_api.py https://YOUR-TUNNEL-URL
"""
import json, sys, urllib.request, urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
results = []


import time

def call(method, path, body=None, retries=3):
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(retries):
        req = urllib.request.Request(BASE + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                time.sleep(0.3)
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, None
        except (TimeoutError, urllib.error.URLError, ConnectionError):
            if attempt == retries - 1:
                raise
            time.sleep(2)


def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS" if ok else "FAIL"), "-", name, detail)


# /index  (v0.3: index = evidence coverage %, band from v0.2 status rules)
ISS = "o2_pct=21&pressure_psi=14.7&flow_cm_s=10&gravity_g=0"
s, d = call("GET", f"/index?{ISS}&materials=pmma,silicone,cotton_fiberglass")
check("/index ISS microgravity, flown materials -> safe, supported, GP spread", s == 200 and d["band"] == "safe"
      and d["confidence"] == "supported" and d["predicted_spread"] is not None,
      f"(index={d and d['index']}, spread={d and (d['predicted_spread'] or {}).get('spread_mm_s')} mm/s)")
s, d = call("GET", f"/index?{ISS}")
check("/index ISS with cotton exposed -> tight (cotton only flown at 26-27% O2)", s == 200 and d["band"] == "tight"
      and d["index"] == 75, f"(index={d and d['index']}, status={d and d['status']})")
s, d = call("GET", "/index?o2_pct=26.9&pressure_psi=11.0&flow_cm_s=20&gravity_g=0&materials=cotton_fabric")
check("/index at Saffire-V V-5 conditions -> supported", s == 200 and d["confidence"] == "supported")
s, d = call("GET", "/index?o2_pct=34")
check("/index lunar 34% / 8.2 psia / 0.166 g -> untested (no partial-g evidence)", s == 200 and d["band"] == "untested"
      and d["confidence"] == "untested" and d["predicted_spread"] is None, f"(index={d and d['index']}, status={d and d['status']})")
check("/index has breakdown + per_material + reasons + disclaimer",
      bool(d) and len(d["breakdown"]) == 5 and len(d["per_material"]) == 4 and d["reasons"] and "disclaimer" in d)
s, d = call("GET", "/index?o2_pct=36")
check("/index lunar O2 above design point -> critical", s == 200 and d["band"] == "critical", f"(status={d and d['status']})")
s, _ = call("GET", "/index?o2_pct=34&materials=unobtainium")
check("/index unknown material -> 422", s == 422)

# /evidence
s, d = call("GET", "/evidence")
check("/evidence returns all rows", s == 200 and d["count"] >= 70, f"(count={d and d['count']})")
s, d = call("GET", "/evidence?investigation=BASS-II")
check("/evidence filter by investigation", s == 200 and d["count"] > 0
      and all(r["investigation"] == "BASS-II" for r in d["rows"]), f"(count={d and d['count']})")
s, d = call("GET", "/evidence/nearest?o2_pct=34&material=cotton_fabric&k=3")
check("/evidence/nearest (Why this?) -> cotton runs, untested at 34%", s == 200 and 1 <= len(d["nearest"]) <= 3
      and d["confidence"] == "untested", f"(closest={d and d['nearest'][0]['run_id']})")
s, d = call("GET", "/evidence")
check("/evidence has no MOCK rows; every verified row has a source link",
      s == 200 and not any(r["run_id"].startswith("MOCK") for r in d["rows"])
      and all(r["source_link"] for r in d["rows"] if r["verified"]), f"(verified={d and sum(r['verified'] for r in d['rows'])})")

# /telemetry
s, d = call("POST", "/telemetry/advance?reset=true")
check("/telemetry/advance reset -> cursor 0", s == 200 and d["cursor"] == 0)
s, d = call("GET", "/telemetry")
check("/telemetry start (lunar, at design point) -> untested", s == 200 and d["index"]["band"] == "untested")
total = d["steps_total"] if d else 0
changed = False
last = None
for i in range(total):
    s, d = call("GET", f"/telemetry?step={i}")
    changed = changed or d["band_changed"]
    last = d
check("/telemetry replay: O2 drift changes band, ends critical", changed and last["index"]["band"] == "critical",
      f"(final O2={last['sample']['o2_pct']})")
s, _ = call("GET", "/telemetry?step=999")
check("/telemetry bad step -> 404", s == 404)

# /whatif
s, d = call("POST", "/whatif", {"current": {"o2_pct": 21, "pressure_psi": 14.7, "gravity_g": 0}})
ok = s == 200 and {"A", "B"} <= {o["id"] for o in d["options"]} and all(o["requires_human_approval"] for o in d["options"])
check("/whatif (ISS) returns options A,B needing human approval", ok)
if ok:
    for o in d["options"]:
        print("      option", o["id"], o["label"], "->", o["projected"]["index"], o["projected"]["band"], f"(delta {o['delta']})")
    check("/whatif (ISS) stowing cotton raises coverage to 100", next(o for o in d["options"] if o["id"] == "A")["projected"]["index"] == 100)
s, d = call("POST", "/whatif", {"current": {"o2_pct": 36}})
c = s == 200 and next((o for o in d["options"] if o["id"] == "C"), None)
check("/whatif (lunar 36%) option C lifts band out of critical; stowing creates no evidence",
      bool(c) and d["baseline"]["band"] == "critical" and c["projected"]["band"] != "critical"
      and all(o["delta"] == 0 for o in d["options"]))
s, d = call("POST", "/whatif/decision", {"option_id": "B", "decision": "approve", "crew_member": "Commander"})
check("/whatif/decision approve -> recorded", s == 200 and d["recorded"]["executed_by"] == "human")
s, _ = call("POST", "/whatif/decision", {"option_id": "Z", "decision": "approve", "crew_member": "x"})
check("/whatif/decision unknown option -> 404", s == 404)
s, _ = call("POST", "/whatif/decision", {"option_id": "A", "decision": "maybe", "crew_member": "x"})
check("/whatif/decision invalid decision -> 422", s == 422)

# /rank
s, d = call("GET", "/rank?preset=lunar")
ok = s == 200 and len(d["investigations"]) > 0 and len(d["envelope"]) == 5
check("/rank lists investigations + envelope for 5 materials", ok)
if ok:
    top = d["investigations"][0]
    print("      top investigation:", top["id"], "relevance", top["relevance"])
    labels = {c["label"] for e in d["envelope"] for c in e["cells"]}
    check("/rank envelope has untested cells at high O2", "untested" in labels, f"(labels={sorted(labels)})")

# /explain and /ask (SI layer)
s, d = call("GET", "/explain?o2_pct=36&from_o2_pct=34")
check("/explain cites runs, explains the change, keeps caveat", s == 200 and len(d["cited_run_ids"]) > 0
      and "34% O2: status Unverified -> Low" in d["answer"] and "not an alarm" in d["answer"],
      f"(cited={d and len(d['cited_run_ids'])})")
ids = {r["run_id"] for r in call("GET", "/evidence")[1]["rows"]}
check("/explain cited runs all exist in evidence", all(r in ids for r in d["cited_run_ids"]))
s, d = call("GET", "/explain?o2_pct=21&pressure_psi=14.7&gravity_g=0&materials=pmma")
check("/explain ISS PMMA states the GP prediction", s == 200 and "PMMA prediction" in d["answer"])
for qn, intent in [("Why did the status drop?", "why"), ("Is this tested?", "coverage"),
                   ("How high can O2 go?", "limit"), ("What can we do?", "options"), ("hello", "unknown")]:
    s, d = call("POST", "/ask", {"question": qn, "current": {"o2_pct": 36}, "from_o2_pct": 34})
    check(f"/ask '{qn}' -> {intent}", s == 200 and d["intent"] == intent)
s, d = call("POST", "/ask", {"question": "How high can O2 go?"})
check("/ask limit never suggests an O2 setting", s == 200 and "do not give an oxygen setting" in d["answer"]
      and "safe band up to" not in d["answer"])

# /procedures (simulated crew procedure set)
s, d = call("GET", "/procedures")
check("/procedures lists 4 simulated procedures", s == 200 and len(d["procedures"]) == 4
      and all(p["source"] == "SIMULATED" for p in d["procedures"]))
s, d = call("GET", "/procedures/fire_event")
check("/procedures fire_event hands off, invents no response steps", s == 200 and len(d["steps"]) == 2
      and "does not provide fire-response steps" in d["steps"][0]["text"])
call("POST", "/procedures/reset")
s, d = call("GET", "/procedures/active?o2_pct=21&pressure_psi=14.7&gravity_g=0&materials=pmma,silicone,cotton_fiberglass")
check("/procedures/active all covered -> no procedure", s == 200 and d["procedure"] is None)
s, d = call("GET", "/procedures/active?o2_pct=21&pressure_psi=14.7&gravity_g=0")
check("/procedures/active ISS with cotton -> margin_tight", s == 200 and d["procedure"]["id"] == "margin_tight")
s, d = call("GET", "/procedures/active?o2_pct=34")
check("/procedures/active lunar design point -> margin_untested, steps pending",
      s == 200 and d["procedure"]["id"] == "margin_untested" and all(x["status"] == "pending" for x in d["steps"]))
proj = [x for x in d["steps"] if "model_projection" in x] if s == 200 else []
check("/procedures steps link to what-if projections", len(proj) == 2)
s, d = call("GET", "/procedures/active?o2_pct=36")
check("/procedures/active above design point -> margin_critical with O2 option C",
      s == 200 and d["procedure"]["id"] == "margin_critical" and any("model_projection" in x for x in d["steps"] if x["id"] == "c4"))
s, d = call("POST", "/procedures/margin_untested/steps/u1", {"crew_member": "Commander", "action": "confirm"})
check("/procedures step confirm recorded by human", s == 200 and d["progress"] == "1/6"
      and d["steps"][0]["record"]["executed_by"] == "human")
s, _ = call("POST", "/procedures/margin_tight/steps/zz", {"crew_member": "x", "action": "confirm"})
check("/procedures unknown step -> 404", s == 404)
s, _ = call("POST", "/procedures/margin_tight/steps/t2", {"crew_member": "x", "action": "run"})
check("/procedures invalid action -> 422", s == 422)
call("POST", "/procedures/reset")

# P3 neural network overlay (firewalled second opinion)
s, d = call("GET", "/mlp?o2_pct=21&pressure_psi=14.7&flow_cm_s=10&gravity_g=0&materials=pmma,kapton")
pm = d["per_material"][0] if s == 200 else {}
check("/mlp station air: PMMA scored, in training domain", s == 200 and pm.get("in_domain") is True
      and abs(sum(pm["scores"].values()) - 1) < 0.01)
check("/mlp untrained material -> no score", s == 200 and d["per_material"][1]["scores"] is None)
s, d = call("GET", "/mlp?o2_pct=34&pressure_psi=8.2&gravity_g=0.166&materials=pmma")
check("/mlp lunar surface flagged out of domain (O2, pressure, gravity)", s == 200
      and not d["per_material"][0]["in_domain"] and len(d["per_material"][0]["issues"]) == 3)
check("/mlp lunar surface: no score or prediction is returned (untested)", s == 200
      and d["per_material"][0]["scores"] is None and d["per_material"][0]["predicted"] is None
      and d["per_material"][0]["untested"] is True)
s, d = call("GET", "/mlp?o2_pct=38&pressure_psi=8.2&gravity_g=0&materials=pmma,cotton_jersey")
check("/mlp out-of-range O2 and pressure, every material: no scores", s == 200
      and all(r["scores"] is None for r in d["per_material"]))
s1, a1 = call("GET", "/index?o2_pct=34&pressure_psi=8.2&gravity_g=0.166&materials=pmma")
call("GET", "/mlp?o2_pct=34&materials=pmma")
s2, a2 = call("GET", "/index?o2_pct=34&pressure_psi=8.2&gravity_g=0.166&materials=pmma")
check("/mlp firewall: calling it never changes /index status", s1 == s2 == 200 and a1["status"] == a2["status"])

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
