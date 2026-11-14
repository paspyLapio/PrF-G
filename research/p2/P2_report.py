
from pathlib import Path
import pandas as pd
from datetime import datetime

BASE = Path(__file__).resolve().parent
OUT = BASE / "results"
OUT.mkdir(exist_ok=True)

# Expected project files
files = [
    "bass_ii_M7.csv",
    "fsm_M7_demo.csv",
    "burn_outcome_data.csv",
    "M7_airflow_vs_spread.png",
    "nasa_report_extracted.txt",
    "bass_ii_gp_model.joblib",
]

# Check which files exist
file_status = {
    name: (OUT / name).exists()
    for name in files
}

# Load the M7 dataset
data_path = OUT / "bass_ii_M7.csv"

if not data_path.exists():
    raise FileNotFoundError(
        "Run main.py first to create bass_ii_M7.csv"
    )

df = pd.read_csv(data_path)

# Basic data summary
number_of_rows = len(df)
number_of_tests = df["test_id"].nunique()
number_of_missing = int(
    df["spread_rate_mm_s"].isna().sum()
)

mean_spread = df["spread_rate_mm_s"].mean()
min_spread = df["spread_rate_mm_s"].min()
max_spread = df["spread_rate_mm_s"].max()

# Create Markdown report
report = f"""
# P2 - Fire Safety Margin Prototype

Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}

## 1. Project objective

Develop an exploratory, physics-informed data analysis
prototype using official NASA combustion research data.

The prototype is intended for research and educational
demonstration. It is NOT a certified fire safety system.

## 2. NASA data source

NASA report:
Burning and Suppression of Solids-II (BASS-II)
NASA/TM-20210011385
NASA Glenn Research Center, 2021.

Dataset subset:
PMMA experiment M7
Table 5.1, report pages 56-57.

## 3. Dataset summary

- Number of observations: {number_of_rows}
- Number of experiments: {number_of_tests}
- Missing spread-rate observations: {number_of_missing}
- Mean measured spread rate: {mean_spread:.4f} mm/s
- Minimum measured spread rate: {min_spread:.4f} mm/s
- Maximum measured spread rate: {max_spread:.4f} mm/s

## 4. Physical variables

- Airflow: cm/s
- Spread rate: mm/s
- Oxygen concentration: percent
- Material: PMMA
- Gravity condition: microgravity

## 5. Fire Safety Margin

A preliminary demonstration index was calculated
from the observed spread-rate range.

It is NOT a validated physical safety margin.
It must not be interpreted as a real-world safety rating.

## 6. Burn outcome

The available M7 observations describe burning conditions.
There are not enough verified extinguished examples
in this subset to train a binary classifier.

Missing outcomes must not be treated as zero spread rates.

## 7. Model limitations

- The current subset contains only one experiment.
- Four observations are insufficient for robust model validation.
- The Gaussian Process output is exploratory.
- Model uncertainty is not a certified confidence level.
- The dataset does not include all required variables,
  including pressure.
- No complete 0-100 safety calibration has been validated.

## 8. Files

"""

for name, exists in file_status.items():
    status = "AVAILABLE" if exists else "NOT FOUND"
    report += f"- {name}: {status}\n"

report += """
## 9. Next research steps

1. Verify and extract additional NASA experiment records.
2. Include both burned and extinguished outcomes.
3. Preserve missing values and source page references.
4. Compare model predictions with independent observations.
5. Validate the Fire Safety Margin before interpreting it.

---
End of preliminary P2 report.
"""

report_path = OUT / "P2_technical_report.md"
report_path.write_text(report, encoding="utf-8")

print("\nP2 REPORT CREATED")
print("======================")
print(report_path.resolve())

print("\nFILE CHECK")
for name, exists in file_status.items():
    print(
        ("[OK] " if exists else "[MISSING] ") + name
    )

print("\nDATA SUMMARY")
print("Observations:", number_of_rows)
print("Experiments:", number_of_tests)
print("Mean spread rate:", round(mean_spread, 4), "mm/s")

print("\nOpen results/P2_technical_report.md")
