
from pathlib import Path
import warnings

import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import (
    ConstantKernel,
    Matern,
    WhiteKernel
)
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# --------------------------------------------------
# 1. PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
RESULTS_DIR = BASE_DIR / "results"

DATA_FILE = Path("/Users/dimitriskoutsos/PycharmProjects/p2/results/bass_ii_PMMA_M1_M20.csv")

RESULTS_DIR.mkdir(exist_ok=True)


# --------------------------------------------------
# 2. LOAD DATA
# --------------------------------------------------

if not DATA_FILE.exists():
    raise FileNotFoundError(
        f"Δεν βρέθηκε το αρχείο: {DATA_FILE}"
    )

df = pd.read_csv(DATA_FILE)

# Κανονικοποίηση ονομάτων στηλών
df.columns = (
    df.columns
    .str.strip()
    .str.lower()
    .str.replace(" ", "_")
)

print("\n--- DATASET ---")
print("Rows loaded:", len(df))
print("Columns:", df.columns.tolist())


# --------------------------------------------------
# 3. COLUMN DETECTION
# --------------------------------------------------

def find_column(possible_names):
    for name in possible_names:
        if name in df.columns:
            return name
    return None


test_col = find_column(["test_id", "experiment_id"])
airflow_col = find_column([
    "airflow_cm_s",
    "airflow",
    "flow_velocity_cm_s"
])
spread_col = find_column([
    "spread_rate_mm_s",
    "spread_rate",
    "flame_spread_rate_mm_s"
])

if not all([test_col, airflow_col, spread_col]):
    raise ValueError(
        "Δεν βρέθηκαν οι απαραίτητες στήλες "
        "(test_id, airflow, spread_rate). "
        "Έλεγξε τα ονόματα των στηλών."
    )


# --------------------------------------------------
# 4. SELECT FEATURES
# --------------------------------------------------

feature_candidates = [
    "thickness_mm",
    "thickness_cm",
    "thickness",
    "width_cm",
    "width",
    "burning_sides",
    "airflow_cm_s",
    "airflow",
    "flow_velocity_cm_s",
    "initial_o2_pct",
    "initial_o2",
    "o2_initial_pct"
]

feature_cols = [
    col for col in feature_candidates
    if col in df.columns
]

# Αφαίρεση διπλών στηλών που μπορεί να είναι aliases
feature_cols = list(dict.fromkeys(feature_cols))

if not feature_cols:
    raise ValueError("Δεν βρέθηκαν αριθμητικά χαρακτηριστικά.")

print("\nFeatures used:")
for col in feature_cols:
    print("-", col)


# --------------------------------------------------
# 5. CLEAN DATA
# --------------------------------------------------

df[spread_col] = pd.to_numeric(
    df[spread_col], errors="coerce"
)

for col in feature_cols:
    df[col] = pd.to_numeric(
        df[col], errors="coerce"
    )

# Κρατάμε μόνο γραμμές με διαθέσιμο target και features
model_df = df.dropna(
    subset=[test_col, spread_col] + feature_cols
).copy()

X = model_df[feature_cols]
y = model_df[spread_col]
groups = model_df[test_col]

print("\n--- CLEANING ---")
print("Usable rows:", len(model_df))
print("Missing spread rates:", df[spread_col].isna().sum())
print("Unique experiments:", groups.nunique())


# --------------------------------------------------
# 6. CHECK DATA
# --------------------------------------------------

if groups.nunique() < 5:
    raise ValueError(
        "Χρειάζονται τουλάχιστον 5 διαφορετικά "
        "πειράματα για 5-fold GroupKFold."
    )

if len(model_df) < 10:
    raise ValueError("Πολύ λίγες διαθέσιμες μετρήσεις.")


# --------------------------------------------------
# 7. DEFINE GAUSSIAN PROCESS MODEL
# --------------------------------------------------

kernel = (
    ConstantKernel(1.0, (1e-2, 1e2))
    * Matern(
        length_scale=1.0,
        length_scale_bounds=(1e-2, 1e2),
        nu=2.5
    )
    + WhiteKernel(
        noise_level=0.01,
        noise_level_bounds=(1e-5, 1e1)
    )
)

model = Pipeline([
    ("scaler", StandardScaler()),
    ("gp", GaussianProcessRegressor(
        kernel=kernel,
        normalize_y=True,
        n_restarts_optimizer=3,
        random_state=42
    ))
])


# --------------------------------------------------
# 8. GROUPED CROSS-VALIDATION
# --------------------------------------------------

cv = GroupKFold(n_splits=5)

print("\n--- CROSS VALIDATION ---")

with warnings.catch_warnings():
    warnings.simplefilter("ignore")

    predictions = cross_val_predict(
        model,
        X,
        y,
        groups=groups,
        cv=cv
    )

mae = mean_absolute_error(y, predictions)
rmse = np.sqrt(mean_squared_error(y, predictions))
r2 = r2_score(y, predictions)

print("MAE:", round(mae, 5), "mm/s")
print("RMSE:", round(rmse, 5), "mm/s")
print("R2:", round(r2, 5))


# --------------------------------------------------
# 9. BASELINE COMPARISON
# --------------------------------------------------

baseline_predictions = np.zeros(len(y))

for train_idx, test_idx in cv.split(X, y, groups):
    baseline_predictions[test_idx] = y.iloc[train_idx].mean()

baseline_mae = mean_absolute_error(
    y, baseline_predictions
)

print("\n--- BASELINE ---")
print("Baseline MAE:", round(baseline_mae, 5))
print("GP MAE:", round(mae, 5))


# --------------------------------------------------
# 10. SAVE CROSS-VALIDATION PREDICTIONS
# --------------------------------------------------

prediction_df = model_df[
    [test_col, spread_col]
].copy()

prediction_df["predicted_spread_rate_mm_s"] = predictions

prediction_df["absolute_error"] = np.abs(
    y.to_numpy() - predictions
)

prediction_df.to_csv(
    RESULTS_DIR / "P2_cross_validation_predictions.csv",
    index=False
)


# --------------------------------------------------
# 11. TRAIN FINAL MODEL ON ALL AVAILABLE DATA
# --------------------------------------------------

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    model.fit(X, y)

joblib.dump(
    model,
    RESULTS_DIR / "P2_gaussian_process_model.joblib"
)


# --------------------------------------------------
# 12. SAVE METRICS
# --------------------------------------------------

metrics = pd.DataFrame([{
    "usable_rows": len(model_df),
    "unique_experiments": groups.nunique(),
    "features": ", ".join(feature_cols),
    "MAE_mm_s": mae,
    "RMSE_mm_s": rmse,
    "R2": r2,
    "baseline_MAE_mm_s": baseline_mae
}])

metrics.to_csv(
    RESULTS_DIR / "P2_model_metrics.csv",
    index=False
)


# --------------------------------------------------
# 13. FINISH
# --------------------------------------------------

print("\n--- FINISHED ---")
print("Saved files:")
print("- P2_cross_validation_predictions.csv")
print("- P2_gaussian_process_model.joblib")
print("- P2_model_metrics.csv")

print("\nIMPORTANT:")
print("This is an experimental prototype.")
print("Results are not scientifically validated.")
print("Verify source measurements before interpretation.")
