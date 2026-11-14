# Neural network (P3)

The MLP is a **second opinion** shown in PrF-G's AI window. It never changes the status, alerts or options.

- Train on `train_pmma_bass2.csv` (39 BASS-II flat-PMMA segments, 18 tests).
- Validate by holding out one whole test at a time (`nn_baseline.py`). Reference: GP x1.25, MLP x1.25, linear x1.31.
- Inputs: ln(heated thickness, mm), O2 % (test mean), airflow cm/s. Output: ln(spread rate, mm/s).
- Answer only inside the training range: heated thickness 0.5-5 mm, O2 17-22.5 %, airflow 2-21 cm/s, about 100 kPa,
  opposed flow, microgravity.

Put here: `mlp_weights.json` (layer weights and biases, activation, input and output scaling) and `mlp.js`, a function
`(lnT, o2, u) => lnSpread`. The app connects it with `PrFG.connectMLP(fn)`.
No `.joblib` / `.pkl` files in the repo (they run code when loaded); export to JSON instead.
