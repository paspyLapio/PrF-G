"""
Baseline for the PrF-G neural network (P3).

Target: ln(spread_rate_mm_s) of flat PMMA slabs, BASS-II, opposed flow, microgravity.
Data:   training/train_pmma_bass2.csv  (39 flow segments from 18 tests)

VALIDATION RULE: hold out one whole TEST at a time (group = test_id).
Segments of the same test share sample, oxygen history and hardware, so a random
split leaks information and gives an error that is too good. Never report training R2.

Reference results with this exact protocol (typical error = exp(mean |log error|)):
    linear model               x1.31
    Gaussian process (app)     x1.25
    MLP 4 / 8 / 8+8 neurons    x1.25
    10-MLP ensemble            x1.25
A network that matches x1.25 is doing well; the data cannot support much better.

Run: python3 nn_baseline.py   (needs pandas, numpy, scikit-learn)
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.neural_network import MLPRegressor
from sklearn.linear_model import LinearRegression

HERE = Path(__file__).resolve().parent
d = pd.read_csv(HERE / "train_pmma_bass2.csv")
d["ln_t"] = np.log(d["heated_thickness_mm"])        # heated thickness: half of it for two-sided burning
d["y"] = np.log(d["spread_rate_mm_s"])

# o2_mean_pct = mean of the TEST's initial and final O2 (per-segment O2 was not reported).
# flow_cms is the measured airflow per segment. Do not use M7 fan_display values.
FEATURES = ["ln_t", "o2_mean_pct"]          # add "flow_cms" to test the 3-input version


def make(kind, seed=0):
    if kind == "linear":
        return LinearRegression()
    return MLPRegressor(hidden_layer_sizes=(8,), activation="tanh", alpha=1.0,
                        solver="lbfgs", max_iter=20000, random_state=seed)


def leave_one_test_out(kind, features):
    errors, preds = [], {}
    for test in d["test_id"].unique():
        tr, te = d[d.test_id != test], d[d.test_id == test]
        X = tr[features].values
        mu, sd = X.mean(0), X.std(0)
        ym, ys = tr.y.mean(), tr.y.std()
        m = make(kind).fit((X - mu) / sd, (tr.y - ym) / ys)
        p = m.predict((te[features].values - mu) / sd) * ys + ym
        errors += list(np.abs(p - te.y))
        preds.update(dict(zip(te.index, p)))
    return float(np.exp(np.mean(errors))), preds


for kind in ("linear", "mlp"):
    err, _ = leave_one_test_out(kind, FEATURES)
    print(f"{kind:7s} inputs={FEATURES}  typical error x{err:.2f}")
