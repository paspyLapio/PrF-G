# Studies behind the data

Every number in the package traces to one of these. Page and table references are in the
`source` column of `raw_runs.csv`.

## Fire experiments (training and evidence data)

| Study | What it gives us | Link |
| --- | --- | --- |
| BASS-II Summary Report, NASA TM (Olson et al., 2021) | 20 PMMA slab tests (M1-M20) with flame spread by flow segment (Table 5.1); Nomex F1-F3; B-tests. ISS Microgravity Science Glovebox, opposed flow. **The training data.** | https://ntrs.nasa.gov/citations/20210011385 |
| Saffire: A Novel Approach to Study of Spacecraft Fire Safety Using Un-Manned Spacecraft (Urban et al., 2017) | Saffire I-III summary table (Table 1, slides 31-32): SIBAL fabric, silicone, PMMA samples on Cygnus | https://ntrs.nasa.gov/citations/20180005168 |
| Olson et al., duct size, sample size and fuel composition on concurrent flame spread (UCL accepted manuscript) | Saffire I-V spread rates for SIBAL and cotton; pressures | https://discovery.ucl.ac.uk/id/eprint/10164340/1/SIBAL-cotton%20revised%20Sept%20per%20review%20track%20changes%20accepted.pdf |
| Fire Safety Implications of Preliminary Results from Saffire IV and V (Urban et al., ICES-2021-266) | Saffire IV-V conditions and outcomes; PMMA at 25.4% O2 burned without spreading (V-3) | https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf |
| Microgravity Flame Spread in Exploration Atmospheres (NASA/TM-2008-215260) | Drop-tower (5 s) 0g flammability limits for Nomex HT90-40, Ultem 1000, Mylar G at 10.2-14.7 psia; Kimwipes spread vs O2, pressure, flow | https://ntrs.nasa.gov/citations/20080034883 |
| BASS-II sensor readings (ICES-2015-196) | Onboard CO/combustion-product sensor readings during BASS-II | https://ntrs.nasa.gov/api/citations/20150019858/downloads/20150019858.pdf |
| Spacecraft Fire Detection: Smoke Properties and Transport in Low-Gravity (Urban et al.) | Smoke particle sizes by material (silicone 263 nm, lamp wick 248 nm, Kapton 114 nm, preliminary) | https://ntrs.nasa.gov/api/citations/20080012612/downloads/20080012612.pdf |
| Smoke Aerosol Measurement Experiment (SAME / SAME-R) | Smoke particle data for Kapton, Teflon, silicone, cotton, Pyrell, DBP (raw data in NASA PSI, not in this package) | https://www.nasa.gov/wp-content/uploads/2025/07/smoke-aerosol-measurement-experiment-same.pdf |

## Onboard systems and alerting (context for PrF-G, not training data)

| Study | Key point | Link |
| --- | --- | --- |
| Overview of ISS U.S. Fire Detection and Suppression System (Whitaker) | Smoke detectors on ventilation intakes; alarm triggers power, fan and O2 shutdown; no pre-fire indication | https://ntrs.nasa.gov/api/citations/20030053429/downloads/20030053429.pdf |
| ICES-2025-126 (Chen, Walker, Williams) | Frequent false fire alarms from dust (20+ automatic responses in 6 years, all false); detectors inhibited during dusty work; recommends AI for anomaly detection | https://ntrs.nasa.gov/api/citations/20250003954/downloads/ICES-2025-126_Final_Rev%20A.pdf |
| CLDP HSI Workshop: Alerts (NASA, 2024) | Alert classes; ISS tones hard to tell apart; recommends speech alerts and procedure-linked alert displays | https://ntrs.nasa.gov/api/citations/20240003565/downloads/CLD%20HSI%20Workshop%20Alerts.pdf |
| 14 CFR 25.1322 Flightcrew alerting (FAA) | Warning: immediate awareness, immediate response; Caution: immediate awareness, subsequent response; Advisory: awareness, may need a response. Alerts must be acknowledgeable; false and nuisance alerts minimised. A design reference only; PrF-G is not certified to it | https://www.law.cornell.edu/cfr/text/14/25.1322 |
| Human Factors Considerations in the Design and Evaluation of Flight Deck Displays and Controls, V2 (Volpe for FAA), Chapter 4 alerting | Most urgent alert first, prioritising simultaneous alerts, acknowledgement does not erase the message, managing nuisance alerts | https://www.volpe.dot.gov/sites/volpe.dot.gov/files/docs/Human_Factors_Considerations_in_the_Design_and_Evaluation_of_Flight_Deck_Displays_and_Controls_V2.pdf |
| Research Questions and Challenges for Improved Spacecraft Fire Detection (decadal white paper) | Multi-sensor networks, early detection, machine learning to separate smoke from lunar dust | https://ntrs.nasa.gov/api/citations/20210022143/downloads/Fire%20detection%20white%20paper%20final%20211031.pdf |
| Early Fire Detection System for Partial and Low Gravity (Guzman et al., NASA GRC) | Smoke and lunar dust overlap in particle size; low-false-alarm detection still open; no neural network yet | https://ntrs.nasa.gov/api/citations/20260005612/downloads/Guzman_GRC2026_FireDetection_v1bREV.pdf |

## Team reports (shared docs; export from each doc's menu if needed)

- Saffire IV-V and TM-2008-215260 Evidence Extraction: https://claude.ai/artifact/JXMdJsHsrX4j7A8c1scWne
- PrF-G Data Sign-off Audit: https://claude.ai/artifact/2Bv5STHP1maPdQKY1DpWkb
- PrF-G Briefing for the Business Plan: https://claude.ai/artifact/4GvweR6TJyk48v94UKwHqj

These open only for people the owner has shared them with.
