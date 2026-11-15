# Design decisions

1. **No number without evidence.** PrF-G reports evidence coverage, O2 headroom and a status. Where NASA has not tested
   the conditions (for example partial gravity), it says "untested" instead of estimating. An early 0-100 "fire margin"
   score was dropped for this reason.
2. **The neural network is an overlay, not the decision maker.** Status, alerts and options come from traceable rules
   and a Gaussian process fitted on NASA flight data. The MLP appears in a separate AI window as a second opinion and
   gives no number outside its training range. Both models reach the same accuracy (about x1.25).
3. **Advisory, crew decides.** PrF-G never changes the cabin. Options show their projected effect; a crew member approves
   or declines, and every decision is logged.
4. **Existing telemetry stays unchanged.** PrF-G adds a decision-support layer on top of the cabin displays and the
   vehicle's caution and warning system. It does not detect fires and never triggers an automatic vehicle action.
5. **Branch 1 (scientist evidence explorer) was dropped.** It did not offer more than long-term research already does.
   Its templates are in `archive/branch1/`.
6. **Alert rules (team Task 3).** Evidence status and alert level are separate. The mapping is a PrF-G product rule,
   not a NASA classification. PrF-G never uses Warning or Emergency:

   | Status | Alert | Crew-facing meaning |
   | --- | --- | --- |
   | NOMINAL | none | Conditions are inside the evaluated evidence |
   | REDUCED | Advisory | Conditions changed; the evidence shows a reduced margin |
   | UNVERIFIED | Advisory | Current conditions are outside the available NASA test evidence |
   | LOW | Caution | The defined critical criteria are met: O2 outside the reference band, or above the design band with under 50% coverage |

   - A notice is created only when the status changes, never on every telemetry update. Priority follows the alert
     level, so REDUCED and UNVERIFIED are the same priority. UNVERIFIED means "not enough evidence", not "more dangerous".
   - Worsening is shown immediately. An improvement must hold for 1.5 s (demo time) before the status changes or a
     notice clears, so sensor noise at a threshold cannot make alerts flicker.
   - Each notice records what changed (cabin values), why (the rule that fired), the evidence context, the O2 trend
     and how many crew options exist. Options are suggestions; the crew decides.
   - Lifecycle: new, then acknowledged, then resolved, then kept in history. Acknowledging never clears an active notice.
     A notice stays on screen until it is acknowledged. A recovery is announced with its reason.
   - Lessons borrowed: distinct urgency levels (ISS), clear speech-capable messages with linked options (CLDP 2024),
     priority ordering, acknowledgement and nuisance-alert suppression (14 CFR 25.1322, FAA human-factors guidance).
     Not borrowed: automatic fire responses or alarm tones.
7. **O2 trend projection (team Task 2).** A linear least-squares fit over the last 8 simulated minutes (by timestamp,
   not a sample count; the window is set in mission setup and still needs validating against real update rates).
   It projects two separate targets:
   - the caution point (design O2 + band), which is a project setting and not a NASA limit;
   - the tested-evidence edge (highest O2 with a NASA result for the weakest exposed material), which is not a fire threshold.

   It shows "Already reached" instead of a negative time and "No upward crossing projected" when O2 is steady or
   falling. A slope smaller than twice its standard error counts as steady. It shows "Projection unavailable" with
   fewer than 5 readings, readings covering under half the window, or a newest reading older than 1 minute.
   Checked against the six worked examples in the Task 2 report (8 / 33.6 min, reached / 8.8 min, 10 / 11 min,
   reached / 18 s, and both falling cases).
8. **Travel scenarios.** Four routes, each with its own phases, gravity and design atmospheres (all are inputs):
   lunar surface (0.166 g), space-station rotation, lunar outpost in NRHO (microgravity) and Mars (seven-month cruise,
   0.38 g surface). Partial gravity is always reported as untested, because NASA PSI has no partial-gravity fire data.
9. **Fire-consequence model (demo only).** Shows what happens if a caution is left unresolved. It never feeds back into
   the evidence status, alerts or options, and PrF-G never fights the fire: the vehicle's caution & warning takes over.
   - Ignition: a confirmed LOW status left unresolved for 15 simulated minutes is followed by an ignition source
     (acknowledging is not fixing). It can also be injected. The ignited item is an exposed material outside NASA
     evidence. If NASA tests show no sustained flame at these conditions, it self-extinguishes.
   - Growth: NFPA 72 t-squared fire. Class by evidence: inside NASA-tested conditions = slow, outside = medium,
     outside and above the caution point = fast (a PrF-G assumption, printed on the report).
   - Cabin response: closed cabin, no venting (as in Apollo 204): ΔP = (γ − 1)·E / V. CO from burned mass with one
     heat of combustion and CO yield for every material (SFPE, PMMA: 24.2 MJ/kg, 0.010 g/g). Detector delay
     20 s armed / 60 s inhibited (demo values).
   - Outcome, judged only against NASA limits: crew pressure limit 15.0 psia (NASA-STD-3001 V2 6006); CO 485 mg/m³
     for 1 h and 114 mg/m³ for 24 h (JSC 20584 Rev C); loss of vehicle at the cabin structural limit (vehicle
     input, default 29 psia from the Apollo 204 Review Board, "at least 29 psia" at rupture); loss of crew if CO
     passes the 1-hour limit first.
   - Cabin volume is a vehicle input: Orion 9.3 m³ (330 ft³, NASA) and ISS 388 m³ (NASA) are the defaults.
   - The loss report lists when PrF-G warned, whether the caution was acknowledged or fixed, which options were on
     screen, when the alarm sounded, and each metric against its NASA limit with the source.
