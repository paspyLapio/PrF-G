# Fire Margin API v0.3 (real data, v0.2 evidence model)

Run locally: `pip install -r requirements.txt && uvicorn app.main:app --reload` -> http://localhost:8000/docs
Smoke test: `python3 test_api.py <base-url>` (46 checks).

| Endpoint | Use |
|---|---|
| GET /index?o2_pct=34&pressure_psi=8.2&flow_cm_s=10&gravity_g=0.166&materials=a,b | index, band, status, reasons, per-material |
| GET /evidence?investigation=&material=&outcome= | real flight runs with source links |
| GET /evidence/nearest?o2_pct=34&material=cotton_fabric | "Why this?": nearest runs + distance |
| GET /telemetry[?step=n] / POST /telemetry/advance?reset= | simulated lunar feed (O2 drift 34->38%, cotton unpacked) |
| POST /whatif {current:{...}} | options A/B/C, all `requires_human_approval` |
| POST /whatif/decision {option_id, decision, crew_member} | human approve/reject, audit-logged |
| GET /rank?preset=lunar[&material=] | ranked investigations + O2 envelope per material |
| GET /mlp?o2_pct=21&pressure_psi=14.7&flow_cm_s=10&gravity_g=0&materials=pmma,silicone | P3 neural network, per material: sustained-burning scores (uncalibrated), training-domain flags. Firewalled: never changes /index |
| GET /explain?o2_pct=36&from_o2_pct=34 | SI layer: plain-language "why", every sentence cites run_ids |
| GET /procedures, /procedures/active?..., /procedures/{id} | SIMULATED crew checklists picked by band (untested / tight / critical); shown, never run |
| POST /procedures/{id}/steps/{step} {crew_member, action: confirm or skip} | human confirms a step; audit-logged |
| POST /ask {question, current:{...}, from_o2_pct} | intents why / coverage / limit (evidence ceiling, never an O2 setting) / options |

Optional inputs on /index and /whatif: `flow_direction` (opposed|concurrent), `pmma_thickness_mm` (4), `pmma_sides` (one|two), `design_o2_pct` (34).

## What the numbers mean (show this to the frontend + pitch)
- `index` = **evidence coverage, 0-100 %**: share of exposed burnable materials that have NASA flight evidence at these
  conditions. NOT a probability of fire, NOT a NASA scale. Label the gauge "Evidence coverage".
- `band` comes from the v0.2 status rules, not numeric cutoffs (the old safe>=60 / tight>=35 and material weights are gone):

| status | band | rule |
|---|---|---|
| Low | critical | O2 screening class "outside reference", or O2 > design point +1 with coverage < 50 % |
| Unverified | untested | no exposed burnable material has evidence here |
| Reduced | tight | coverage < 100 %, or O2 class "high", or O2 above highest flight-tested O2, or airflow 0-5 cm/s |
| Nominal | safe | everything else |

  TEAM DECISION: confirm this mapping matches the gauge colours and the demo script (`STATUS_TO_BAND` in app/model.py).
- `predicted_spread`: PMMA slab spread rate from the Gaussian process (39 BASS-II segments, 18 tests, held-out typical
  error x1.30). Only inside its domain (heated thickness 0.5-5 mm, O2 17-22.5 %, flow 2-21 cm/s, 97-103 kPa, opposed, micro); else null.
- `o2_headroom_pts`: highest flight-tested O2 of the weakest material minus cabin O2 (negative = above tested range).
- Partial gravity (e.g. 0.166 g): PSI has no partial-g data, so materials are "untested" there. Microgravity and 1 g are bounds.

## Data (every number traces to a source)
data/evidence.json = 76 records: 70 flight runs (BASS-II M1-M20 segments, B2/B6/B14/B20, Nomex F1-F3; Saffire I-V) and
6 drop-tower limit points (NASA/TM-2008-215260: Nomex HT90-40, Ultem 1000, Mylar G). 72 are `verified: true` with
`source_link`; the 4 unverified are B2/B6/B14/B20 (secondary source). All BASS-II M1-M20 values match NASA Table 5.1.
Saffire IV-4 and V-5 (UCL labels) are folded into IV-1 and V-2 (same burns, NASA ICES conditions kept).
Unreported values are `null`, never matched (missing pressure/flow/gravity = 0.5 scale units in the distance; rows
without O2 not used). M7 O2 = test initial/final mean (`o2_basis`), not per segment.
Regenerate from the repo root: `python3 tools/fill_backend_data.py api`.
engine_materials.json (30 materials, evidence categories A/B/C), gp_pmma.json, screening_bands.json (app classification,
not official NASA). materials.json `flammability` is legacy and unused by the model.

## Deploy (permanent URL)
Render: render.com -> New -> Blueprint -> pick the repo (uses the root render.yaml, which builds the api/ folder).
Free plan sleeps after ~15 min idle: open /docs a minute before presenting. Backup: local `uvicorn` + tunnel, laptop on power
(`caffeinate -d` on macOS), and the recorded demo video.
