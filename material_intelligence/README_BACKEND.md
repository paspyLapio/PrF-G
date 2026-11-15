# Material Intelligence — backend integration

This package is a backend-focused continuation of the uploaded project. Existing UI files were not present in the upload, so no frontend changes were made.

## Run
1. Install `numpy` and `pandas`.
2. Supply the prepared model-input CSV at `data/runs.csv` (it stays local).
   The trainer uses only configured features and the target from this table;
   supporting/reference CSVs with different schemas are not concatenated.
3. Run `python main.py --data data/runs.csv --artifacts artifacts`.
4. Load artifacts with `model_artifacts.load_artifacts(...)`.
5. Construct `MaterialIntelligenceService` and call `assess_record(record, candidates)`.

The model target remains `sustained`. Change `config.TARGET` only after deciding the prediction-time use case and reviewing leakage. Do not include post-outcome measurements as predictors for pre-test predictions. In particular, `o2_final_pct`, `o2_mean_pct`, spread rate, mass consumption, burn duration, burn length, and outcome-derived fields should not be used for pre-test prediction.

Training validates the configured feature columns in the CSV, uses investigation/test identifiers for grouped holdout and cross-validation, fits preprocessing only on each training partition, and saves the fitted preprocessing state with the MLP artifacts. MLP initialization is seeded for repeatable runs.

## Safety and interpretation
- Candidate scenarios must be supplied by a qualified human. The optimizer does not generate or apply settings.
- Use `default_variable_specs()` as a schema inventory; gravity is marked non-controllable and every variable has no approved envelope by default. All variables default to no approved envelope. The optimizer withholds candidates lacking explicit qualified bounds or metadata. No literature-derived numeric bounds are supplied because the cited papers are not transferable universal operating limits.
- Safety gate is a screening workflow, not certification. A nonzero predicted adverse-class score triggers review; scores are uncalibrated softmax outputs, not causal effects or calibrated fire-risk probabilities.
- Domain checks flag numeric extrapolation (absolute standardized distance > 3) and unseen categories. This is a diagnostic, not statistical uncertainty calibration.
- `MaterialAnalyzer` ±2 standard deviations is descriptive historical variation only, never an engineering limit.
- `RiskEngine`'s triage index is a heuristic; do not use it as a probability of harm.
- Feedback is append-only and tagged `training_use=not_approved`; no automatic retraining occurs.

## Data split / evaluation caveats
The existing group split keeps rows sharing investigation/test identifiers together. A single holdout is not enough for model validation. For deployment, add repeated group-aware cross-validation, class-wise sensitivity reporting, calibration checks, and an independent test set. If `investigation` and `test_id` are not globally unique identifiers, confirm the grouping key before training.

## Evidence notes
See `research_evidence.py`. Evidence is specific to material/configuration/regime. Research notes do not authorize setpoints, control bounds, or cross-material extrapolation. The evidence registry records:
- PMMA thin sheets: oxygen concentration, pressure, opposed flow, and gravity effects in the tested regimes (Ries et al., 2024).
- CFRP sheets: non-monotonic flow dependence in limiting oxygen concentration (Kobayashi et al., 2024).
- Unidirectional CFRP: a 2026 ICES proceedings paper describes an oxygen-dependent analytical flame-spread model; its study-specific comparison is not a transferable safety limit.
- Current NASA-STD-6001B with Change 3: active standard for material evaluation/testing/selection in its stated scope.
- Harper et al. (2016): oxygen concentration versus partial-pressure interpretation for the evaluated datasets.
- NASA configuration-analysis guidance: partial-gravity evidence limitations.

## Feedback loop
Append follow-up results using `FeedbackLedger.append` with `scenario_id`, `prediction_record`, `actual_record`, and `reviewer`. Include actual test identifiers, outcome, performance measures, conditions, deviations, and reviewer disposition inside the two records. Do not add feedback to training until a separate governance/review process approves it.

## File/API boundary
`backend_service.py` provides a facade returning a JSON-serializable `RecommendationPayload` for an existing frontend. It deliberately does not assume or modify any frontend contract beyond the shared payload dataclass. Map its fields in the current UI rather than replacing the UI.
