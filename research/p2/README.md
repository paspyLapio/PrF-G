# P2 research: BASS-II dataset and first GP model

- `bass_ii_PMMA_M1_M20.csv`: independent transcription of NASA/TM-20210011385 Table 5.1 (43 rows, 39 with spread rate).
  All values agree with `data/raw_runs.csv`, and both match Table 5.1 text extracted from the NASA PDF.
- `P2_technical_report.md`, `P2_train_model.py`: first GP (5 raw inputs, linear target): R2 0.32 with grouped CV.
- The app's GP uses ln(heated thickness), mean O2 and a log target: R2 0.77, typical error x1.25 with the same CV.
Exploratory work; the app does not use this model.
