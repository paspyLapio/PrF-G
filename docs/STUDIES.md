# Studies behind the data

Every number in the package traces to one of these. Page and table references are in the
`source` column of `raw_runs.csv`.

Sorting rule: **NASA sources** are published or hosted by NASA (NTRS, nasa.gov, PSI, NASA standards).
**Non-NASA sources** are published elsewhere (journals, universities, regulators, media), even when NASA
researchers are co-authors.

---

# Part 1 — NASA sources

## 1.1 Fire experiments (training and evidence data)

| Study | What it gives us | Link |
| --- | --- | --- |
| BASS-II Summary Report, NASA/TM-20210011385 (Olson et al., 2021) | 20 PMMA slab tests (M1-M20) with flame spread by flow segment (Table 5.1); Nomex F1-F3; B-tests. ISS Microgravity Science Glovebox, opposed flow. **The training data.** | https://ntrs.nasa.gov/citations/20210011385 |
| Combustion of Solids in Microgravity: Results from the BASS-II Experiment (Ferkul et al.) | PMMA rod concurrent-flow limit (13.6% O2 in microgravity vs 16% blowoff in 1 g); flow window for thin sheets | https://ntrs.nasa.gov/api/citations/20160000593/downloads/20160000593.pdf |
| BASS-II sensor readings (ICES-2015-196) | Onboard CO/combustion-product sensor readings during BASS-II | https://ntrs.nasa.gov/api/citations/20150019858/downloads/20150019858.pdf |
| Saffire: A Novel Approach to Study of Spacecraft Fire Safety Using Un-Manned Spacecraft (Urban et al., 2017) | Saffire I-III summary table (Table 1, slides 31-32): SIBAL fabric, silicone, PMMA samples on Cygnus | https://ntrs.nasa.gov/citations/20180005168 |
| Results of Large-Scale Spacecraft Flammability Tests (Ferkul et al., ICES 2017) | Saffire I-III sample conditions and outcomes | https://ntrs.nasa.gov/citations/20170008805 |
| Fire Safety Implications of Preliminary Results from Saffire IV and V (Urban et al., ICES-2021-266) | Saffire IV-V conditions and outcomes; PMMA at 25.4% O2 burned without spreading (V-3) | https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf |
| Saffire ICES 2021 presentation (Urban et al.) | Saffire IV-V conditions and results tables | https://ntrs.nasa.gov/api/citations/20210017780/downloads/Saffire%20ICES%202021%20Saffire%20Final%20presentation%20compressed.pdf |
| Saffire, ICES-2024-365 (paper) | Later Saffire results and context | https://ntrs.nasa.gov/citations/20240002981 |
| Saffire ICES 2024 presentation | Later Saffire results and context | https://ntrs.nasa.gov/api/citations/20240007488/downloads/Saffire%20ICES%202024%20Saffire%20presentation072124small.pdf |
| Microgravity Flame Spread in Exploration Atmospheres, NASA/TM-2008-215260 | Drop-tower (5 s) 0 g flammability limits for Nomex HT90-40, Ultem 1000, Mylar G at 10.2-14.7 psia; Kimwipes spread vs O2, pressure, flow | https://ntrs.nasa.gov/citations/20080034883 |
| FLEX droplet combustion results | Limiting oxygen for methanol droplets (about 12-13% O2); droplet result, not transferable to solids | https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20130014061.pdf |
| ACME experiments paper (JASMAC 2021) | ACME BRE, CFI-G, E-FIELD, CLD Flame, Flame Design, s-Flame descriptions | https://ntrs.nasa.gov/api/citations/20210021781/downloads/JASMAC%20ACME%20paper%2020210921.pdf |

## 1.2 Investigation records and data repository

| Source | What it gives us | Link |
| --- | --- | --- |
| NASA Physical Sciences Informatics (PSI) | The challenge's data repository | https://science.nasa.gov/physical-sciences-informatics-psi/ |
| NASA PSI-25: BASS-II | Official investigation record | https://psi.nasa.gov/physci/repo/data/investigations/PSI-25 |
| NASA PSI-98: Saffire-I | Official investigation record | https://psi.nasa.gov/physci/repo/data/investigations/PSI-98 |
| NASA PSI-101: SAME-R | Official investigation record (SAME-R catalogue) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-101 |
| Burning Rate Emulator (BRE), NASA Science | BRE is a gaseous surrogate, kept separate from solid burn tests | https://science.nasa.gov/biological-physical/investigations/bre/ |
| NASA Space Apps 2026 challenge "Flame in Freefall" | Challenge text; source for DAFT/DAFT-2, FLEX-2, CFI, SPICE, SLICE and BASS descriptions | https://www.spaceappschallenge.org/2026/ |

## 1.3 Smoke and detection

| Study | What it gives us | Link |
| --- | --- | --- |
| Smoke Aerosol Measurement Experiment (SAME / SAME-R), NASA fact sheet | Smoke particle data for Kapton, Teflon, silicone, cotton, Pyrell, DBP | https://www.nasa.gov/wp-content/uploads/2025/07/smoke-aerosol-measurement-experiment-same.pdf |
| Particle Morphology and Size Results from the Smoke Aerosol Measurement Experiment-2 (Urban et al., ICES 2012, AIAA 2012-3536) | SAME-2 smoke particle sizes by material | https://ntrs.nasa.gov/citations/20130000422 |
| Spacecraft Fire Detection: Smoke Properties and Transport in Low-Gravity (Urban et al.) | Smoke particle sizes by material (silicone 263 nm, lamp wick 248 nm, Kapton 114 nm, preliminary) | https://ntrs.nasa.gov/api/citations/20080012612/downloads/20080012612.pdf |
| Fire Detection Tradeoffs as a Function of Vehicle Parameters (Urban, Dietrich, Brooker, Meyer, Ruff, ICES) | Detection design trade-offs | https://ntrs.nasa.gov/api/citations/20170000248/downloads/20170000248.pdf |
| JSC-20584 Spacecraft Maximum Allowable Concentrations (SMACs), Rev D | Exposure limits for combustion products | https://www.nasa.gov/wp-content/uploads/2026/02/jsc-20584-smacs-rev-d.pdf |

## 1.4 Onboard systems and alerting (context for PrF-G, not training data)

| Study | Key point | Link |
| --- | --- | --- |
| Overview of ISS U.S. Fire Detection and Suppression System (Whitaker) | Smoke detectors on ventilation intakes; alarm triggers power, fan and O2 shutdown; no pre-fire indication | https://ntrs.nasa.gov/api/citations/20030053429/downloads/20030053429.pdf |
| ICES-2025-126 (Chen, Walker, Williams) | Frequent false fire alarms from dust (20+ automatic responses in 6 years, all false); detectors inhibited during dusty work; recommends AI for anomaly detection | https://ntrs.nasa.gov/api/citations/20250003954/downloads/ICES-2025-126_Final_Rev%20A.pdf |
| CLDP HSI Workshop: Alerts (NASA, 2024) | Alert classes; ISS tones hard to tell apart; recommends speech alerts and procedure-linked alert displays | https://ntrs.nasa.gov/api/citations/20240003565/downloads/CLD%20HSI%20Workshop%20Alerts.pdf |
| Research Questions and Challenges for Improved Spacecraft Fire Detection (decadal white paper) | Multi-sensor networks, early detection, machine learning to separate smoke from lunar dust | https://ntrs.nasa.gov/api/citations/20210022143/downloads/Fire%20detection%20white%20paper%20final%20211031.pdf |
| Early Fire Detection System for Partial and Low Gravity (Guzman et al., NASA GRC) | Smoke and lunar dust overlap in particle size; low-false-alarm detection still open; no neural network yet | https://ntrs.nasa.gov/api/citations/20260005612/downloads/Guzman_GRC2026_FireDetection_v1bREV.pdf |

## 1.5 Standards and history

| Source | What it gives us | Link |
| --- | --- | --- |
| Report of the Apollo 204 Review Board (NASA, 1967) | Fire reported 23:31:04.7 GMT; cabin ruptured about 23:31:19 at "at least 29 psia"; lethal atmosphere by 23:31:30. Default structural limit in the fire-consequence model | https://www.nasa.gov/wp-content/uploads/static/history/Apollo204/invest.html |
| JSC 20584 Rev C, Spacecraft Maximum Allowable Concentrations | CO 425 ppm (485 mg/m³) 1 h, 100 ppm (114 mg/m³) 24 h: CO limits in the fire-consequence model | https://ntrs.nasa.gov/api/citations/20240007713/downloads/JSC%2020584_SMACs_Rev%20C_FINAL.pdf |
| OCHMO-TB-003 Habitable Atmosphere (NASA technical brief on NASA-STD-3001 Vol. 2) | [V2 6006] total pressure 5.0-15.0 psia; [V2 6003] hypoxia floor 122 mmHg (2.36 psia) | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf |
| Orion crew module (NASA) | Habitable volume 330 ft³ (9.3 m³): default cabin volume | https://www.nasa.gov/reference/crew-module/ |
| NASA-STD-6001B with Change 3 (2025), Flammability, Offgassing, and Compatibility Requirements and Test Procedures | Test 1 pass criterion; ground (1 g) certification behind the launch STANDBY status | https://standards.nasa.gov/standard/nasa/nasa-std-6001 |
| NASA-STD-3001 Volume 2, Revision F, NASA Spaceflight Human-System Standard | Cabin pressure and atmosphere limits | https://standards.nasa.gov/human-factors-and-health |
| NSS 1740.15 Safety Standard for Oxygen and Oxygen Systems (NASA, 1996) | Oxygen-system safety context | https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19960021046.pdf |
| Fire Safety: A Case Study of Technology Transfer, NASA-CR-2594 (Heins, 1975) | Historical spacecraft materials | https://ntrs.nasa.gov/citations/19750020895 |
| NASA Task Book | Certification criteria research context | https://taskbook.nasaprs.com |

---

# Part 2 — Non-NASA sources

## 2.1 Fire experiments

| Study | What it gives us | Link |
| --- | --- | --- |
| Olson et al., duct size, sample size and fuel composition effects on concurrent flame spread (UCL accepted manuscript) | Saffire I-V spread rates for SIBAL and cotton; pressures | https://discovery.ucl.ac.uk/id/eprint/10164340/1/SIBAL-cotton%20revised%20Sept%20per%20review%20track%20changes%20accepted.pdf |
| Operation and Development Status of the Spacecraft Fire Experiments (Saffire) (Ruff & Urban, ICES 2016; Texas Tech repository, NASA authors) | Saffire I-III design and sample configurations | https://ttu-ir.tdl.org/items/13214cfa-9512-4ac8-aa12-ed55ca61bb13 |
| BASS-II summary paper (ICES; Texas Tech repository) | Flames always quenched when ventilation stopped (normal ISS air); may not hold at elevated O2 / low pressure | https://ttu-ir.tdl.org/items/1922ad9f-ef4c-4f52-96a4-980c23debe5e |
| SDSU flame data catalogue | BASS-II thin-PMMA test points (Bhattacharjee) | flame.sdsu.edu |
| MicroFire Atlas (secondary) | BASS-II B-test values other than flow direction; exact publication not identified | not identified |

## 2.2 Smoke and detection (journal papers, NIST with NASA co-authors)

| Study | What it gives us | Link |
| --- | --- | --- |
| Pyrolysis Smoke Generated Under Low-Gravity Conditions (Yang, Cleary, Mulholland et al., Aerosol Science and Technology 49, 2015) | Smoke particle sizes for Kapton, Teflon, silicone, lamp wick, DBP, Pyrell; zero-flow effect | https://doi.org/10.1080/02786826.2015.1025125 |
| Smoke Characterization and Feasibility of the Moment Method for Spacecraft Fire Detection (Yang et al., Aerosol Science and Technology 49, 2015) | Smoke moments for detector design | https://doi.org/10.1080/02786826.2015.1025124 |
| Evaluation of Spacecraft Smoke Detector Performance in the Low-Gravity Environment (Yang et al., Fire Safety Journal 98, 2018) | Detectors respond differently by material; small Kapton/Teflon particles are harder to detect | https://doi.org/10.1016/j.firesaf.2018.04.004 |

## 2.3 Alerting design references (aviation)

| Source | Key point | Link |
| --- | --- | --- |
| 14 CFR 25.1322 Flightcrew alerting (FAA) | Warning: immediate awareness, immediate response; Caution: immediate awareness, subsequent response; Advisory: awareness, may need a response. Alerts must be acknowledgeable; false and nuisance alerts minimised. A design reference only; PrF-G is not certified to it | https://www.law.cornell.edu/cfr/text/14/25.1322 |
| Human Factors Considerations in the Design and Evaluation of Flight Deck Displays and Controls, V2 (Volpe for FAA), Chapter 4 alerting | Most urgent alert first, prioritising simultaneous alerts, acknowledgement does not erase the message, managing nuisance alerts | https://www.volpe.dot.gov/sites/volpe.dot.gov/files/docs/Human_Factors_Considerations_in_the_Design_and_Evaluation_of_Flight_Deck_Displays_and_Controls_V2.pdf |

## 2.4 Fire engineering references (fire-consequence model physics)

| Source | What it gives us | Link |
| --- | --- | --- |
| NFPA 72, National Fire Alarm and Signaling Code, Annex B (t-squared fires) | Growth coefficients: slow 0.00293, medium 0.01172, fast 0.0469 kW/s² | https://www.nfpa.org/codes-and-standards/nfpa-72-standard-development/72 |
| SFPE Handbook of Fire Protection Engineering (Tewarson, generation of heat and chemical compounds in fires) | PMMA effective heat of combustion 24.2 MJ/kg, CO yield 0.010 g/g | https://link.springer.com/referencework/10.1007/978-1-4939-2565-0 |

## 2.5 Context and media (not test data)

- Space.com, "Fire-in-space experiment could soon make its way to the moon": https://www.space.com/international-space-station-nasa-fire-experiment-moon
- ISS official Instagram post on the Saffire-I composite image (secondary; not cited as evidence).

## 2.6 Material descriptions only (not test data)

Product pages used only to describe what a material is: Kimwipes (eBay), Kapton polyimide (Croylek),
PTFE sheet (BuyPlastic), PTFE fibre (Gore), aramid fabric (Nam Liong), Nomex fabric (supplier page),
open-cell foam (Thea Foam).

---

## Still unresolved

- "Materials Flammability Research Update" (Saffire IV-V table): not found under that title; the Saffire IV-V
  tables we used are in ICES-2021-266 and the ICES 2021 presentation (Part 1.1).
- "MicroFire Atlas" (secondary source for BASS-II B-test values): exact publication not identified.

## Team reports (shared docs; export from each doc's menu if needed)

- Saffire IV-V and TM-2008-215260 Evidence Extraction: https://claude.ai/artifact/JXMdJsHsrX4j7A8c1scWne
- PrF-G Data Sign-off Audit: https://claude.ai/artifact/2Bv5STHP1maPdQKY1DpWkb
- PrF-G Briefing for the Business Plan: https://claude.ai/artifact/4GvweR6TJyk48v94UKwHqj

These open only for people the owner has shared them with.
