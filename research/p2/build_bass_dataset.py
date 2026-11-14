
from pathlib import Path
import pandas as pd

BASE = Path(__file__).resolve().parent
OUT = BASE / "results"
OUT.mkdir(exist_ok=True)

# NASA BASS-II Summary Report
# NASA/TM-20210011385, Table 5.1, printed page 57
# PMMA experiments M1-M20
#
# One row = one test at one airflow velocity.
# None means the spread rate was not tracked.

tests = [
    ("M1",  1, 2.2, 1, [9],             [0.071],                         6.4, 22.2, 21.9),
    ("M2",  3, 2.2, 1, [20, 15],        [0.052, 0.033],                 22.9, 22.2, 21.2),
    ("M3",  5, 2.2, 1, [10, 20],        [0.029, 0.024],                 20.1, 20.8, 19.7),
    ("M4",  5, 2.2, 2, [5, 3],          [0.045, 0.033],                 19.8, 21.8, 19.8),
    ("M5",  3, 2.2, 2, [10],            [0.071],                        27.2, 22.2, 19.0),
    ("M6",  1, 2.2, 2, [10, 8],         [None, None],                   16.8, 21.8, 20.7),
    ("M7",  1, 1.2, 2, [10, 6, 5, 3],   [0.106, 0.099, 0.083, 0.070],  18.4, 18.9, 18.4),
    ("M8",  2, 1.2, 2, [10, 6, 5],      [0.057, 0.056, 0.040],         25.2, 19.1, 18.2),
    ("M9",  3, 1.2, 2, [14],            [0.025],                        16.8, 18.0, 17.6),
    ("M10", 4, 1.2, 2, [15, 10],        [0.0373, 0.030],               30.5, 20.1, 18.6),
    ("M11", 5, 1.2, 2, [21, 15, 13],    [0.048, 0.028, 0.022],         28.5, 20.0, 18.5),
    ("M12", 2, 2.2, 2, [12, 10],        [None, None],                   16.2, 21.7, 20.4),
    ("M13", 4, 2.2, 2, [6, 5, 4],       [0.047, 0.035, 0.033],         20.5, 20.8, 19.0),
    ("M14", 2, 2.2, 1, [15, 14, 10],    [0.0624, 0.055, 0.0353],       15.4, 22.2, 21.6),
    ("M15", 4, 2.2, 1, [20],            [0.045],                        22.0, 21.0, 20.0),
    ("M16", 1, 2.2, 2, [5, 3, 2],       [0.144, 0.1309, 0.1062],        8.4, 19.2, 18.7),
    ("M17", 2, 2.2, 2, [5, 4, 3],       [0.053, 0.042, 0.026],         30.7, 18.8, 17.1),
    ("M18", 3, 2.2, 2, [10, 8],         [0.026, 0.013],                25.5, 17.9, 16.8),
    ("M19", 4, 2.2, 2, [10, 6],         [0.027, 0.0159],               25.7, 19.0, 17.4),
    ("M20", 5, 2.2, 2, [10],            [0.012],                        16.5, 18.0, 17.4),
]

rows = []

for (
    test_id,
    thickness,
    width,
    sides,
    airflows,
    spread_rates,
    burn_time,
    initial_o2,
    final_o2
) in tests:

    if len(airflows) != len(spread_rates):
        raise ValueError(f"Unmatched values in {test_id}")

    for airflow, spread_rate in zip(airflows, spread_rates):
        rows.append({
            "test_id": test_id,
            "material": "PMMA",
            "gravity": "microgravity",
            "thickness_mm": thickness,
            "width_cm": width,
            "burning_sides": sides,
            "airflow_cm_s": airflow,
            "spread_rate_mm_s": spread_rate,
            "burn_time_min": burn_time,
            "initial_o2_pct": initial_o2,
            "final_o2_pct": final_o2,
            "burn_outcome": "burned_test",
            "source": "NASA/TM-20210011385",
            "source_table": "Table 5.1",
            "source_page": 57
        })

df = pd.DataFrame(rows)

# Data quality checks
assert df["test_id"].nunique() == 20
assert df["airflow_cm_s"].notna().all()
assert (df["airflow_cm_s"] > 0).all()

# Keep missing spread rates as missing values.
df["spread_rate_mm_s"] = pd.to_numeric(
    df["spread_rate_mm_s"],
    errors="coerce"
)

output = OUT / "bass_ii_PMMA_M1_M20.csv"
df.to_csv(output, index=False)

print("\nNASA BASS-II DATASET CREATED")
print("============================")
print("Experiments:", df["test_id"].nunique())
print("Rows:", len(df))
print("Tracked spread rates:", df["spread_rate_mm_s"].notna().sum())
print("Missing spread rates:", df["spread_rate_mm_s"].isna().sum())
print("Unique airflow values:", sorted(df["airflow_cm_s"].unique()))

print("\nRows per experiment:")
print(df.groupby("test_id").size().to_string())

print("\nSaved to:")
print(output.resolve())

print("\nIMPORTANT:")
print("This is a transcription of Table 5.1.")
print("Check the source PDF before scientific use.")
print("Missing measurements are not zero.")
print("burned_test is a test-level label, not a")
print("label for every individual airflow segment.")
