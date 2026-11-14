# P2 — Physics-Informed Flame Spread Analysis
## NASA Space Apps Challenge 2026 — Flame in Freefall

**Report date:** 14 November 2026  
**Model:** Gaussian Process Regression (GPR)  
**Dataset:** NASA BASS-II PMMA experiments M1–M20

---

## 1. Project Objective

The objective of this project is to develop an exploratory, physics-informed data analysis prototype for studying flame spread behaviour under microgravity conditions.

The prototype uses experimental data from NASA's Burning and Suppression of Solids–II (BASS-II) research programme.

The main objective of the P2 model is to investigate whether selected experimental variables can help estimate the flame spread rate of PMMA.

The project is intended for scientific exploration and educational demonstration. It is not a certified fire safety system and must not be used to make real-world fire safety decisions.

### 2. NASA Data Source

**Primary source:**

NASA Glenn Research Center, *Burning and Suppression of Solids–II (BASS-II) Summary Report*.

- NASA Technical Memorandum: NASA/TM-20210011385
- Publication year: 2021
- Relevant dataset: Table 5.1
- Report pages: approximately 56–57

Official NASA record:  
https://ntrs.nasa.gov/citations/20210011385

Official report PDF:  
https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf

The PMMA dataset contains experimental records M1–M20.

**Data verification status:** All 43 CSV observations were successfully compared against the Table 5.1 transcription supplied for this project. The verification script found zero missing rows, zero unexpected rows, and zero numerical discrepancies in the compared fields. The four untracked spread-rate measurements were correctly preserved as missing values.

This confirms consistency with the supplied NASA table transcription.

## 3. Dataset Description

The dataset file is:

`bass_ii_PMMA_M1_M20.csv`

Dataset statistics:

| Property | Value |
|---|---:|
| Total rows | 43 |
| Experiment IDs | 20 |
| Rows with valid spread-rate measurements | 39 |
| Missing spread-rate measurements | 4 |
| Unique experiments represented in usable data | 18 |

The four missing spread-rate measurements are retained as missing values and are excluded from model training. They are not interpreted as zero.

### 3.1 Variables

The dataset contains the following fields:

- `test_id`: experimental identifier
- `material`: fuel material
- `gravity`: gravity condition
- `thickness_mm`: sample thickness in millimetres
- `width_cm`: sample width in centimetres
- `burning_sides`: number of burning sides
- `airflow_cm_s`: airflow velocity in centimetres per second
- `spread_rate_mm_s`: measured flame spread rate in millimetres per second
- `burn_time_min`: burn time in minutes, consistent with the supplied NASA Table 5.1 transcription.
- `initial_o2_pct`: initial oxygen concentration
- `final_o2_pct`: final oxygen concentration
- `burn_outcome`: test-level outcome
- `source`, `source_table`, `source_page`: source provenance fields

### 3.2 Data Handling

Rows without a valid spread-rate measurement are excluded from regression training.

The oxygen measurements are treated as test-level measurements. Repeated values across airflow segments do not represent independent oxygen measurements for every segment.

The `burn_outcome` field is also a test-level label. The current dataset contains only `burned_test` labels and does not provide a suitable collection of extinguished examples for binary classification.

The burn-time variable is recorded in minutes, consistent with the supplied NASA Table 5.1 transcription.

## 4. Model Methodology

A Gaussian Process Regression (GPR) model was developed to estimate flame spread rate from selected experimental variables.

### 4.1 Input Features

The model uses five input features:

1. Sample thickness (`thickness_mm`)
2. Sample width (`width_cm`)
3. Number of burning sides (`burning_sides`)
4. Airflow velocity (`airflow_cm_s`)
5. Initial oxygen concentration (`initial_o2_pct`)

The `gravity` field is retained as dataset metadata and is not currently used as a model input.

### 4.2 Target Variable

The prediction target is:

`spread_rate_mm_s`

The target represents measured flame spread rate in millimetres per second.

### 4.3 Cross-Validation

The model was evaluated using five-fold GroupKFold cross-validation.

The groups are defined by `test_id`, ensuring that rows from the same experiment are not split between training and validation folds.

This approach helps reduce data leakage between related observations from the same experiment.

The final saved model was subsequently fitted using all 39 usable observations.

## 5. Model Performance

The following results were obtained from the completed training run:

| Metric | Result |
|---|---:|
| Mean Absolute Error (MAE) | 0.01950 mm/s |
| Root Mean Squared Error (RMSE) | 0.02675 mm/s |
| Coefficient of Determination (R²) | 0.25545 |
| Baseline MAE | 0.02456 mm/s |

### 5.1 Interpretation

The Gaussian Process model achieved a lower MAE than the mean-prediction baseline.

However, the R² value of 0.25545 indicates limited explanatory performance.

The model captures some variation in the observed spread rates, but its predictions remain uncertain and should not be considered highly reliable.

The results support treating the model as an exploratory prototype rather than a validated predictive system.

## 6. Visualization Analysis

Three visualizations were generated to evaluate model behaviour and explore relationships in the dataset.

### 6.1 Actual vs. Predicted Spread Rate

**File:** `results/P2_actual_vs_predicted.png`

This plot compares measured spread rates with model predictions.

The ideal prediction line represents equality between measured and predicted values.

The visual analysis indicates that:

- Some lower spread-rate predictions are relatively close to the ideal line.
- Several higher observed spread rates are underestimated.
- Prediction errors become more noticeable for some observations at higher spread rates.

These observations are consistent with the model's limited R² value.

### 6.2 Residual Analysis

**File:** `results/P2_residual_analysis.png`

Residuals represent the difference between actual and predicted spread rates.

The preliminary visual inspection suggests that residual dispersion increases at higher predicted spread rates.

This may indicate heteroscedasticity, meaning that prediction error variance is not constant across the prediction range.

Some larger positive residuals may indicate underprediction, depending on the residual convention used by the script.

This observation should be confirmed directly from the saved cross-validation predictions and residual calculations.

### 6.3 Airflow vs. Flame Spread Rate

**File:** `results/P2_airflow_vs_spread.png`

This plot explores the observed relationship between airflow velocity and flame spread rate.

The preliminary visual inspection suggests substantial variation in spread rate at some airflow levels.

In particular, observations at similar airflow velocities can have noticeably different spread rates.

This suggests that airflow alone is insufficient to explain all observed variation.

Other experimental variables, such as sample geometry and oxygen conditions, may also be relevant.

The scatter plot is descriptive and does not establish causation.

## 7. Scientific Limitations

- **Limited dataset:** The model uses only 39 observations from 18 experiments with valid spread-rate measurements.
- **Limited predictive performance:** The R² value indicates that the model explains only a limited portion of the observed variation.
- **Data scope:** The current dataset does not contain suitable extinguished-test examples for classification.
- **Residual uncertainty:** Prediction errors may vary across the prediction range.
- **Source verification:** The CSV has been checked against the supplied Table 5.1 transcription. Independent verification against the original NASA PDF remains a separate provenance check.

The model is an exploratory research prototype and must not be used as a certified fire-safety prediction system.