"""
spread_model.py - Branch 1, first validated model: flame spread over PMMA slabs,
opposed flow, microgravity (BASS-II, NASA/TM-20210011385 Table 5.1).

Model:  ln V = b0 + b1 ln(heated thickness) + b2 * O2%
Valid ONLY inside the tested domain: PMMA, opposed flow, microgravity,
heated thickness 0.5-5 mm, O2 about 17-22%, flow 2-21 cm/s.
Outside it, predict() returns no number and says why.

Validation: leave-one-test-out (a whole test is held out, not single segments).
Run: python3 spread_model.py
"""
import csv
import math

import numpy as np

CLASS = "pmma|slab|opposed|micro|MSG"
DOMAIN = {"heated_thickness_mm": (0.5, 5.0), "o2_pct": (17.0, 22.5), "flow_cms": (2.0, 21.0)}


def load(path="runs.csv"):
    rows = [r for r in csv.DictReader(open(path, encoding="utf-8"))
            if r["comparability_class"] == CLASS and r["spread_rate_mm_s"]]
    X = np.array([[1.0, math.log(float(r["heated_thickness_mm"])), float(r["o2_mean_pct"])] for r in rows])
    y = np.array([math.log(float(r["spread_rate_mm_s"])) for r in rows])
    groups = np.array([r["test_id"] for r in rows])
    return X, y, groups


def fit(X, y):
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ b
    sigma = math.sqrt((resid ** 2).sum() / max(1, len(y) - X.shape[1]))
    return b, sigma


def validate(X, y, groups):
    errs = []
    for g in np.unique(groups):
        tr, te = groups != g, groups == g
        b, _ = fit(X[tr], y[tr])
        errs += list(X[te] @ b - y[te])
    return math.sqrt(np.mean(np.square(errs)))


def predict(b, sigma, heated_thickness_mm, o2_pct, flow_cms):
    q = {"heated_thickness_mm": heated_thickness_mm, "o2_pct": o2_pct, "flow_cms": flow_cms}
    outside = [k for k, (lo, hi) in DOMAIN.items() if not lo <= q[k] <= hi]
    if outside:
        return {"status": "untested", "reason": "outside tested range: " + ", ".join(outside)}
    ln_v = b[0] + b[1] * math.log(heated_thickness_mm) + b[2] * o2_pct
    return {"status": "supported", "spread_mm_s": round(math.exp(ln_v), 4),
            "band_mm_s": (round(math.exp(ln_v - sigma), 4), round(math.exp(ln_v + sigma), 4))}


if __name__ == "__main__":
    X, y, groups = load()
    b, sigma = fit(X, y)
    print(f"Fitted on {len(y)} segments / {len(set(groups))} tests")
    print(f"ln V = {b[0]:.2f} {b[1]:+.2f} ln(heated thickness mm) {b[2]:+.3f} O2%   (residual sd {sigma:.2f})")
    print(f"Leave-one-test-out typical error: x{math.exp(validate(X, y, groups)):.2f}")
    print("Example 2 mm slab burning on both sides (1 mm heated), 20% O2, 10 cm/s:", predict(b, sigma, 1.0, 20.0, 10.0))
    print("Same at 34% O2 (lunar):", predict(b, sigma, 1.0, 34.0, 10.0))
