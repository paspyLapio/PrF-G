# Design decisions

1. **No number without evidence.** PrF-G reports evidence coverage, O2 headroom and a status. Where NASA has not tested
   the conditions (for example partial gravity), it says "untested" instead of estimating. An early 0-100 "fire margin"
   score was dropped for this reason.
2. **The neural network is an overlay, not the decision maker.** Status, alerts and options come from traceable rules
   and a Gaussian process fitted on NASA flight data. The MLP appears in a separate AI window as a second opinion and
   gives no number outside its training range. Both models reach the same accuracy (about x1.25).
3. **Advisory, crew decides.** PrF-G never changes the cabin. Options show their projected effect; a crew member approves
   or declines, and every decision is logged.
4. **Existing telemetry stays unchanged.** PrF-G adds a layer on top of the cabin displays and alarms; it raises only
   advisory and caution alerts, and only when the status worsens. It does not detect fires.
5. **Branch 1 (scientist evidence explorer) was dropped.** It did not offer more than long-term research already does.
   Its templates are in `archive/branch1/`.
