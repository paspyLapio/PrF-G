
from pathlib import Path
import pandas as pd
import numpy as np

# Official NASA BASS-II Table 5.1 transcription
# Each airflow value corresponds to one observation.

NASA_DATA = {
    "M1":  (1, 2.2, 1, [9],             [0.071],                         6.4, 22.2, 21.9),
    "M2":  (3, 2.2, 1, [20, 15],        [0.052, 0.033],                  22.9, 22.2, 21.2),
    "M3":  (5, 2.2, 1, [10, 20],        [0.029, 0.024],                  20.1, 20.8, 19.7),
    "M4":  (5, 2.2, 2, [5, 3],          [0.045, 0.033],                  19.8, 21.8, 19.8),
    "M5":  (3, 2.2, 2, [10],            [0.071],                         27.2, 22.2, 19.0),
    "M6":  (1, 2.2, 2, [10, 8],         [None, None],                    16.8, 21.8, 20.7),
    "M7":  (1, 1.2, 2, [10, 6, 5, 3],  [0.106, 0.099, 0.083, 0.070],   18.4, 18.9, 18.4),
    "M8":  (2, 1.2, 2, [10, 6, 5],     [0.057, 0.056, 0.040],          25.2, 19.1, 18.2),
    "M9":  (3, 1.2, 2, [14],            [0.025],                         16.8, 18.0, 17.6),
    "M10": (4, 1.2, 2, [15, 10],        [0.0373, 0.030],                 30.5, 20.1, 18.6),
    "M11": (5, 1.2, 2, [21, 15, 13],    [0.048, 0.028, 0.022],          28.5, 20.0, 18.5),
    "M12": (2, 2.2, 2, [12, 10],        [None, None],                    16.2, 21.7, 20.4),
    "M13": (4, 2.2, 2, [6, 5, 4],       [0.047, 0.035, 0.033],          20.5, 20.8, 19.0),
    "M14": (2, 2.2, 1, [15, 14, 10],    [0.0624, 0.055, 0.0353],        15.4, 22.2, 21.6),
    "M15": (4, 2.2, 1, [20],            [0.045],                         22.0, 21.0, 20.0),
    "M16": (1, 2.2, 2, [5, 3, 2],       [0.144, 0.1309, 0.1062],        8.4, 19.2, 18.7),
    "M17": (2, 2.2, 2, [5, 4, 3],       [0.053, 0.042, 0.026],          30.7, 18.8, 17.1),
    "M18": (3, 2.2, 2, [10, 8],         [0.026, 0.013],                 25.5, 17.9, 16.8),
    "M19": (4, 2.2, 2, [10, 6],         [0.027, 0.0159],                25.7, 19.0, 17.4),
    "M20": (5, 2.2, 2, [10],            [0.012],                         16.5, 18.0, 17.4),
}

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "results" / "bass_ii_PMMA_M1_M20.csv"

df = pd.read_csv(CSV_PATH)

required_columns = [
    "test_id", "thickness_mm", "width_cm", "burning_sides",
    "airflow_cm_s", "spread_rate_mm_s", "burn_time_min",
    "initial_o2_pct", "final_o2_pct"
]

missing_columns = [c for c in required_columns if c not in df.columns]

if missing_columns:
    raise ValueError(f"Missing CSV columns: {missing_columns}")

# Convert numeric columns safely
numeric_columns = required_columns[1:]

for col in numeric_columns:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df["test_id"] = df["test_id"].astype(str).str.strip()

expected_rows = []

for test_id, values in NASA_DATA.items():
    thickness, width, sides, airflows, spreads, burn_time, initial_o2, final_o2 = values

    for airflow, spread in zip(airflows, spreads):
        expected_rows.append({
            "test_id": test_id,
            "thickness_mm": thickness,
            "width_cm": width,
            "burning_sides": sides,
            "airflow_cm_s": airflow,
            "spread_rate_mm_s": spread,
            "burn_time_min": burn_time,
            "initial_o2_pct": initial_o2,
            "final_o2_pct": final_o2,
        })

expected = pd.DataFrame(expected_rows)

print("\n--- DATASET SIZE ---")
print("CSV rows:", len(df))
print("Expected rows:", len(expected))
print("Expected experiments:", len(NASA_DATA))

# Match observations by experiment ID and airflow.
# This avoids depending on the order of rows in the CSV.
keys = ["test_id", "airflow_cm_s"]

if df.duplicated(keys).any():
    print("\nERROR: Duplicate test_id + airflow combinations in CSV:")
    print(df[df.duplicated(keys, keep=False)][keys].to_string(index=False))
    raise SystemExit("Please investigate duplicate rows.")

if expected.duplicated(keys).any():
    raise SystemExit("Duplicate keys in the reference data.")

actual_index = df.set_index(keys)
expected_index = expected.set_index(keys)

missing_keys = expected_index.index.difference(actual_index.index)
extra_keys = actual_index.index.difference(expected_index.index)

print("\n--- ROW MATCHING ---")
print("Missing expected rows:", len(missing_keys))
print("Unexpected CSV rows:", len(extra_keys))

if len(missing_keys):
    print("Missing:", list(missing_keys))

if len(extra_keys):
    print("Unexpected:", list(extra_keys))

fields = [
    "thickness_mm",
    "width_cm",
    "burning_sides",
    "spread_rate_mm_s",
    "burn_time_min",
    "initial_o2_pct",
    "final_o2_pct",
]

errors = []

for key in expected_index.index.intersection(actual_index.index):
    expected_row = expected_index.loc[key]
    actual_row = actual_index.loc[key]

    for field in fields:
        expected_value = expected_row[field]
        actual_value = actual_row[field]

        if pd.isna(expected_value) and pd.isna(actual_value):
            continue

        if pd.isna(expected_value) != pd.isna(actual_value):
            errors.append((key, field, expected_value, actual_value))
            continue

        if not np.isclose(
            float(expected_value),
            float(actual_value),
            atol=0.00001,
            rtol=0
        ):
            errors.append((key, field, expected_value, actual_value))

print("\n--- VALUE COMPARISON ---")

if errors:
    print(f"Found {len(errors)} discrepancies:\n")

    for key, field, expected_value, actual_value in errors:
        print(
            f"{key} | {field}: "
            f"NASA reference={expected_value}, CSV={actual_value}"
        )
else:
    print("All matched values are correct.")

print("\n--- MISSING SPREAD-RATE CHECK ---")
print("NASA reference missing values:", expected["spread_rate_mm_s"].isna().sum())
print("CSV missing values:", df["spread_rate_mm_s"].isna().sum())

if len(missing_keys) == 0 and len(extra_keys) == 0 and len(errors) == 0:
    print("\nSUCCESS: CSV matches the supplied NASA Table 5.1 transcription.")
else:
    print("\nCHECK REQUIRED: Fix the discrepancies before using the dataset.")
