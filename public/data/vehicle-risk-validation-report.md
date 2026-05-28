# Vehicle Risk Prediction Accuracy

Generated: 2026-05-28 05:43 America/New_York

**Caveat:** These predictions are place/time risk indicators only. They are not reasonable suspicion, probable cause, or a basis to target any person, vehicle, or specific address.

## Latest Results

| Forecast | Window | Actual Incidents | Combined Hit Rate | Combined Precision | Combined PAI |
| --- | --- | ---: | ---: | ---: | ---: |
| 2026-05-22 | 2026-05-22 through 2026-05-25 | 25 | 0.0% | 0.0% | 0.00 |

## Forecast 2026-05-22

Forecast window: 2026-05-22 through 2026-05-25
Actual matching incidents: 25

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 25 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 13 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 12 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

## How To Read This

- Hit rate is the share of actual incidents captured by the selected forecast cells.
- Precision is the share of selected forecast cells that had at least one actual incident.
- Baseline compares the model to a simple recent-hot-spots approach.
- Brier score is probability error; lower is better.
- PAI is concentration efficiency; higher is better.
- False positives are selected forecast cells with no matching incident.

