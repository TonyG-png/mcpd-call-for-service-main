# Vehicle Risk Prediction Accuracy

Generated: 2026-06-21 04:31 America/New_York

**Caveat:** These predictions are place/time risk indicators only. They are not reasonable suspicion, probable cause, or a basis to target any person, vehicle, or specific address.

## Latest Results

| Forecast | Window | Actual Incidents | Exact Hit Rate | 6h/1,500 ft | 12h/1,500 ft | 24h/1,500 ft | Median Miss |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-16 | 2026-06-16 through 2026-06-19 | 31 | 0.0% | 6.5% | 9.7% | 9.7% | 32965 ft |
| 2026-06-15 | 2026-06-15 through 2026-06-18 | 40 | 0.0% | 0.0% | 0.0% | 0.0% | 54121 ft |
| 2026-06-14 | 2026-06-14 through 2026-06-17 | 43 | 0.0% | 0.0% | 0.0% | 0.0% | 54121 ft |
| 2026-06-13 | 2026-06-13 through 2026-06-16 | 39 | 0.0% | 0.0% | 0.0% | 0.0% | 63778 ft |
| 2026-06-12 | 2026-06-12 through 2026-06-15 | 40 | 0.0% | 0.0% | 0.0% | 0.0% | 64757 ft |
| 2026-06-08 | 2026-06-08 through 2026-06-11 | 46 | 2.2% | 4.3% | 6.5% | 8.7% | 34362 ft |
| 2026-06-03 | 2026-06-03 through 2026-06-06 | 43 | 0.0% | 2.3% | 2.3% | 4.7% | 30487 ft |
| 2026-06-02 | 2026-06-02 through 2026-06-05 | 34 | 0.0% | 2.9% | 2.9% | 2.9% | 20251 ft |
| 2026-06-01 | 2026-06-01 through 2026-06-04 | 29 | 0.0% | 0.0% | 0.0% | 0.0% | 69456 ft |
| 2026-05-31 | 2026-05-31 through 2026-06-03 | 32 | 0.0% | 0.0% | 6.3% | 9.4% | 37400 ft |
| 2026-05-30 | 2026-05-30 through 2026-06-02 | 35 | 0.0% | 0.0% | 5.7% | 8.6% | 32060 ft |
| 2026-05-29 | 2026-05-29 through 2026-06-01 | 39 | 0.0% | 0.0% | 5.1% | 5.1% | 37400 ft |
| 2026-05-28 | 2026-05-28 through 2026-05-31 | 42 | 0.0% | 0.0% | 0.0% | 0.0% | 41323 ft |
| 2026-05-26 | 2026-05-26 through 2026-05-29 | 52 | 0.0% | 1.9% | 1.9% | 1.9% | 29400 ft |
| 2026-05-22 | 2026-05-22 through 2026-05-25 | 33 | 0.0% | 0.0% | 0.0% | 0.0% | 55154 ft |

## Forecast 2026-06-16

Forecast window: 2026-06-16 through 2026-06-19
Actual matching incidents: 31

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 31 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Theft From Auto | 11 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 20 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 6.5% / 4.0% | 6.5% / 4.0% | 9.7% / 5.0% | 9.7% / 5.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 5.0% / 4.0% | 5.0% / 4.0% | 10.0% / 4.5% | 10.0% / 5.3% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 31 | 0 (0.0%) | 2 (6.5%) | 2 (6.5%) | 4 (12.9%) | 9 (29.0%) | 32965 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 11600 BLK STEWART LA | 2026-06-18 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 1244 ft | 3I1 / SILVER SPRING |
| 1600 BLK WHITE OAK VISTA DR | 2026-06-18 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 1454 ft | 3I1 / SILVER SPRING |
| 11500 BLK FEBRUARY CIR | 2026-06-16 12:00-18:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 3116 ft | 3I1 / SILVER SPRING |
| 10700 BLK BLOSSOM LA | 2026-06-16 12:00-18:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 4128 ft | 3I3 / SILVER SPRING |
| 2100 BLK GLENALLAN AVE | 2026-06-17 18:00-00:00 | Theft From Auto | 1100 BLK UNIVERSITY BLV | 10182 ft | 4L3 / WHEATON |
| 2000 BLK HARLEQUIN TER | 2026-06-18 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 10502 ft | 3I1 / SILVER SPRING |
| 500 BLK SOUTHAMPTON DR | 2026-06-16 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 11799 ft | 3I3 / SILVER SPRING |
| 2500 BLK GLENALLAN AVE | 2026-06-17 18:00-00:00 | Theft From Auto | 1100 BLK UNIVERSITY BLV | 12251 ft | 4L3 / WHEATON |

## Forecast 2026-06-15

Forecast window: 2026-06-15 through 2026-06-18
Actual matching incidents: 40

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 40 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 12 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 28 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 1 (2.5%) | 7 (17.5%) | 54121 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 11500 BLK FEBRUARY CIR | 2026-06-16 12:00-18:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 3116 ft | 3I1 / SILVER SPRING |
| 10700 BLK BLOSSOM LA | 2026-06-16 12:00-18:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 4128 ft | 3I3 / SILVER SPRING |
| 1000 BLK RUATAN ST | 2026-06-15 18:00-00:00 | Theft From Auto | 800 BLK ELLSWORTH DR | 9848 ft | 3G3 / SILVER SPRING |
| 2100 BLK GLENALLAN AVE | 2026-06-17 18:00-00:00 | Theft From Auto | 1100 BLK UNIVERSITY BLV | 10182 ft | 4L3 / WHEATON |
| 500 BLK SOUTHAMPTON DR | 2026-06-16 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 11799 ft | 3I3 / SILVER SPRING |
| 2500 BLK GLENALLAN AVE | 2026-06-17 18:00-00:00 | Theft From Auto | 1100 BLK UNIVERSITY BLV | 12251 ft | 4L3 / WHEATON |
| 5100 BLK POOKS HILL RD | 2026-06-15 12:00-18:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 21350 ft | 2E1 / BETHESDA |
| 5100 BLK POOKS HILL RD | 2026-06-15 12:00-18:00 | Theft From Auto | 8500 BLK CAMERON ST | 21350 ft | 2E1 / BETHESDA |

## Forecast 2026-06-14

Forecast window: 2026-06-14 through 2026-06-17
Actual matching incidents: 43

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 43 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 12 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 31 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 3.2% / 4.0% | 3.2% / 4.0% | 3.2% / 5.6% | 3.2% / 6.7% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 43 | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 3 (7.0%) | 9 (20.9%) | 54121 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 11200 BLK LOCKWOOD DR | 2026-06-14 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 2354 ft | 3I1 / SILVER SPRING |
| 11500 BLK FEBRUARY CIR | 2026-06-16 12:00-18:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 3116 ft | 3I1 / SILVER SPRING |
| 10700 BLK BLOSSOM LA | 2026-06-16 12:00-18:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 4128 ft | 3I3 / SILVER SPRING |
| 1000 BLK RUATAN ST | 2026-06-15 18:00-00:00 | Theft From Auto | 800 BLK ELLSWORTH DR | 9848 ft | 3G3 / SILVER SPRING |
| 12300 BLK HERRINGTON MANOR DR | 2026-06-14 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 11056 ft | 3I1 / SILVER SPRING |
| 500 BLK SOUTHAMPTON DR | 2026-06-16 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 11799 ft | 3I3 / SILVER SPRING |
| 5100 BLK POOKS HILL RD | 2026-06-15 12:00-18:00 | Stolen Vehicle | 1100 BLK UNIVERSITY BLV | 22143 ft | 2E1 / BETHESDA |
| 5100 BLK POOKS HILL RD | 2026-06-15 12:00-18:00 | Theft From Auto | 1100 BLK UNIVERSITY BLV | 22143 ft | 2E1 / BETHESDA |

## Forecast 2026-06-13

Forecast window: 2026-06-13 through 2026-06-16
Actual matching incidents: 39

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 39 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 12 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 27 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 3.7% / 4.0% | 3.7% / 4.0% | 3.7% / 4.5% | 3.7% / 4.5% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 39 | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 2 (5.1%) | 3 (7.7%) | 63778 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 11200 BLK LOCKWOOD DR | 2026-06-14 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 2354 ft | 3I1 / SILVER SPRING |
| 9600 BLK DEWITT DR | 2026-06-13 12:00-18:00 | Theft From Auto | 8500 BLK CAMERON ST | 9192 ft | 2D1 / BETHESDA |
| 1000 BLK RUATAN ST | 2026-06-15 18:00-00:00 | Theft From Auto | 800 BLK ELLSWORTH DR | 9848 ft | 3G3 / SILVER SPRING |
| 12300 BLK HERRINGTON MANOR DR | 2026-06-14 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 11056 ft | 3I1 / SILVER SPRING |
| 5100 BLK POOKS HILL RD | 2026-06-15 12:00-18:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 21350 ft | 2E1 / BETHESDA |
| 5100 BLK POOKS HILL RD | 2026-06-15 12:00-18:00 | Theft From Auto | 8500 BLK CAMERON ST | 21350 ft | 2E1 / BETHESDA |
| 4700 BLK WYACONDA RD | 2026-06-13 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 24791 ft | 2D1 / BETHESDA |
| 2600 BLK CAMELBACK LA | 2026-06-14 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 30541 ft | 4K1 / WHEATON |

## Forecast 2026-06-12

Forecast window: 2026-06-12 through 2026-06-15
Actual matching incidents: 40

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 40 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 14 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 26 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 3.9% / 4.0% | 3.9% / 4.0% | 3.9% / 4.5% | 3.9% / 4.8% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 3 (7.5%) | 6 (15.0%) | 64757 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 11200 BLK LOCKWOOD DR | 2026-06-14 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 2354 ft | 3I1 / SILVER SPRING |
| 9500 BLK COLUMBIA BLV | 2026-06-12 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 5344 ft | 3G2 / SILVER SPRING |
| 9600 BLK DEWITT DR | 2026-06-13 12:00-18:00 | Theft From Auto | 8500 BLK CAMERON ST | 9192 ft | 2D1 / BETHESDA |
| 8700 BLK CARROLL AVE | 2026-06-12 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 10312 ft | 3G3 / SILVER SPRING |
| 12300 BLK HERRINGTON MANOR DR | 2026-06-14 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 11056 ft | 3I1 / SILVER SPRING |
| Unknown location | 2026-06-12 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 11584 ft | 3I1 / SILVER SPRING |
| 700 BLK BEACON RD | 2026-06-12 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 12003 ft | 3I3 / SILVER SPRING |
| 4700 BLK WYACONDA RD | 2026-06-13 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 24791 ft | 2D1 / BETHESDA |

## Forecast 2026-06-08

Forecast window: 2026-06-08 through 2026-06-11
Actual matching incidents: 46

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 46 | 25 | 2.2% | 2.2% | 4.0% | 0.039 | 10.24 | 24 |
| Theft From Auto | 22 | 25 | 4.5% | 4.5% | 4.0% | 0.039 | 28.55 | 24 |
| Stolen Vehicle | 24 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 2.2% / 4.0% | 4.3% / 20.0% | 4.3% / 24.0% | 6.5% / 20.0% | 8.7% / 25.0% |
| Theft From Auto | 4.5% / 4.0% | 4.5% / 8.0% | 4.5% / 8.0% | 4.5% / 12.5% | 4.5% / 12.5% |
| Stolen Vehicle | 0.0% / 0.0% | 4.2% / 8.0% | 4.2% / 8.0% | 4.2% / 9.1% | 8.3% / 13.6% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 46 | 1 (2.2%) | 2 (4.3%) | 2 (4.3%) | 6 (13.0%) | 11 (23.9%) | 34362 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 8200 BLK GEORGIA AVE | 2026-06-09 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 510 ft | 3G1 / SILVER SPRING |
| 8500 BLK GEORGIA AVE | 2026-06-09 18:00-00:00 | Stolen Vehicle | 1100 BLK BONIFANT ST | 747 ft | 3G1 / SILVER SPRING |
| 700 BLK LAMBERTON DR | 2026-06-08 18:00-00:00 | Stolen Vehicle | 1100 BLK UNIVERSITY BLV | 3993 ft | 4L1 / WHEATON |
| 500 BLK ALBANY AVE | 2026-06-10 18:00-00:00 | Theft From Auto | 900 BLK SILVER SPRING AVE | 4773 ft | 8T1 / TAKOMA PARK |
| 11400 BLK CHERRY HILL RD | 2026-06-08 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 9126 ft | 3I1 / SILVER SPRING |
| 7400 BLK GLENSIDE DR | 2026-06-09 18:00-00:00 | Stolen Vehicle | 900 BLK SILVER SPRING AVE | 10173 ft | 8T3 / TAKOMA PARK |
| 2100 BLK HARLEQUIN TER | 2026-06-08 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 10843 ft | 3I1 / SILVER SPRING |
| 2000 BLK AQUAMARINE TER | 2026-06-09 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 11203 ft | 3I1 / SILVER SPRING |

## Forecast 2026-06-03

Forecast window: 2026-06-03 through 2026-06-06
Actual matching incidents: 43

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 43 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 25 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 18 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 2.3% / 4.0% | 4.7% / 4.0% | 2.3% / 5.0% | 4.7% / 10.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 43 | 0 (0.0%) | 1 (2.3%) | 2 (4.7%) | 2 (4.7%) | 9 (20.9%) | 30487 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 1500 BLK HEATHER HOLLOW CIR | 2026-06-04 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 807 ft | 3I1 / SILVER SPRING |
| 11300 BLK LOCKWOOD DR | 2026-06-04 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 1547 ft | 3I1 / SILVER SPRING |
| 1700 BLK EAST WEST HWY | 2026-06-04 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 2614 ft | 2D1 / BETHESDA |
| 2000 BLK FOREST HILL DR | 2026-06-04 18:00-00:00 | Theft From Auto | 9700 BLK MT PISGAH RD | 3270 ft | 3I3 / SILVER SPRING |
| 2000 BLK FOREST HILL DR | 2026-06-04 18:00-00:00 | Stolen Vehicle | 9700 BLK MT PISGAH RD | 3270 ft | 3I3 / SILVER SPRING |
| 400 BLK SOUTHAMPTON DR | 2026-06-04 18:00-00:00 | Stolen Vehicle | 9700 BLK MT PISGAH RD | 3726 ft | 3I3 / SILVER SPRING |
| 300 BLK SOUTHAMPTON DR | 2026-06-04 18:00-00:00 | Stolen Vehicle | 9700 BLK MT PISGAH RD | 3902 ft | 3I3 / SILVER SPRING |
| 800 BLK E FRANKLIN AVE | 2026-06-04 18:00-00:00 | Theft From Auto | 9700 BLK MT PISGAH RD | 5371 ft | 3G3 / SILVER SPRING |

## Forecast 2026-06-02

Forecast window: 2026-06-02 through 2026-06-05
Actual matching incidents: 34

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 34 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 20 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 14 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 2.9% / 4.0% | 5.9% / 4.0% | 2.9% / 4.8% | 2.9% / 4.8% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 34 | 0 (0.0%) | 1 (2.9%) | 2 (5.9%) | 2 (5.9%) | 9 (26.5%) | 20251 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 1500 BLK HEATHER HOLLOW CIR | 2026-06-04 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 807 ft | 3I1 / SILVER SPRING |
| 11300 BLK LOCKWOOD DR | 2026-06-04 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 1547 ft | 3I1 / SILVER SPRING |
| 1700 BLK EAST WEST HWY | 2026-06-04 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 2614 ft | 2D1 / BETHESDA |
| 2000 BLK FOREST HILL DR | 2026-06-04 18:00-00:00 | Theft From Auto | 9700 BLK MT PISGAH RD | 3270 ft | 3I3 / SILVER SPRING |
| 2000 BLK FOREST HILL DR | 2026-06-04 18:00-00:00 | Stolen Vehicle | 9700 BLK MT PISGAH RD | 3270 ft | 3I3 / SILVER SPRING |
| 400 BLK SOUTHAMPTON DR | 2026-06-04 18:00-00:00 | Stolen Vehicle | 9700 BLK MT PISGAH RD | 3726 ft | 3I3 / SILVER SPRING |
| 300 BLK SOUTHAMPTON DR | 2026-06-04 18:00-00:00 | Stolen Vehicle | 9700 BLK MT PISGAH RD | 3902 ft | 3I3 / SILVER SPRING |
| 800 BLK E FRANKLIN AVE | 2026-06-04 18:00-00:00 | Theft From Auto | 9700 BLK MT PISGAH RD | 5371 ft | 3G3 / SILVER SPRING |

## Forecast 2026-06-01

Forecast window: 2026-06-01 through 2026-06-04
Actual matching incidents: 29

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 29 | 25 | 0.0% | 0.0% | 0.0% | 0.003 | 0.00 | 25 |
| Theft From Auto | 14 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Stolen Vehicle | 15 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 29 | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 4 (13.8%) | 69456 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| Unknown location | 2026-06-02 12:00-18:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 5791 ft | 3I3 / SILVER SPRING |
| 4500 BLK EVERETT ST | 2026-06-02 18:00-00:00 | Theft From Auto | 8500 BLK CAMERON ST | 19080 ft | 2D1 / BETHESDA |
| 1200 BLK KATHRYN RD | 2026-06-01 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 21518 ft | 3I1 / SILVER SPRING |
| 12700 BLK SUMMERWOOD DR | 2026-06-01 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 33993 ft | 3I1 / SILVER SPRING |
| 1 BLK NORMANDY SQUARE CT | 2026-06-01 18:00-00:00 | Stolen Vehicle | 8700 BLK CAMERON ST | 38162 ft | 4K1 / WHEATON |
| 700 BLK TWINBROOK PKW | 2026-06-02 12:00-18:00 | Theft From Auto | 8700 BLK CAMERON ST | 38319 ft | 1A2 / ROCKVILLE |
| 13500 BLK GREENCASTLE RIDGE TER | 2026-06-03 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 39232 ft | 3I2 / SILVER SPRING |
| 8900 BLK BRADLEY BLV | 2026-06-03 12:00-18:00 | Theft From Auto | 8700 BLK CAMERON ST | 43225 ft | 2E2 / BETHESDA |

## Forecast 2026-05-31

Forecast window: 2026-05-31 through 2026-06-03
Actual matching incidents: 32

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 32 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 16 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 16 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 6.3% / 4.0% | 6.3% / 10.5% | 9.4% / 15.8% |
| Theft From Auto | 0.0% / 0.0% | 12.5% / 4.0% | 12.5% / 8.0% | 12.5% / 18.8% | 12.5% / 18.8% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 32 | 0 (0.0%) | 0 (0.0%) | 2 (6.3%) | 5 (15.6%) | 7 (21.9%) | 37400 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 8000 BLK EASTERN AVE | 2026-05-31 12:00-18:00 | Stolen Vehicle | 1100 BLK BONIFANT ST | 1898 ft | 3G1 / SILVER SPRING |
| 8700 BLK CAMERON ST | 2026-05-31 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 2107 ft | 3G1 / SILVER SPRING |
| 1200 BLK SPRING ST | 2026-05-31 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 2767 ft | 3G1 / SILVER SPRING |
| 1200 BLK KATHRYN RD | 2026-06-01 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 2927 ft | 3I1 / SILVER SPRING |
| Unknown location | 2026-06-02 12:00-18:00 | Stolen Vehicle | 900 BLK SILVER SPRING AVE | 7891 ft | 3I3 / SILVER SPRING |
| 100 BLK LEXINGTON DR | 2026-05-31 12:00-18:00 | Theft From Auto | 900 BLK SILVER SPRING AVE | 10574 ft | 3I3 / SILVER SPRING |
| 12700 BLK SUMMERWOOD DR | 2026-06-01 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 15359 ft | 3I1 / SILVER SPRING |
| 7100 BLK WISCONSIN AVE | 2026-05-31 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 18434 ft | 2D2 / BETHESDA |

## Forecast 2026-05-30

Forecast window: 2026-05-30 through 2026-06-02
Actual matching incidents: 35

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 35 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 18 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 17 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 5.7% / 4.0% | 5.7% / 10.5% | 8.6% / 15.8% |
| Theft From Auto | 0.0% / 0.0% | 11.1% / 4.0% | 11.1% / 8.0% | 11.1% / 18.8% | 11.1% / 18.8% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 35 | 0 (0.0%) | 0 (0.0%) | 2 (5.7%) | 5 (14.3%) | 7 (20.0%) | 32060 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 8000 BLK EASTERN AVE | 2026-05-31 12:00-18:00 | Stolen Vehicle | 1100 BLK BONIFANT ST | 1898 ft | 3G1 / SILVER SPRING |
| 8700 BLK CAMERON ST | 2026-05-31 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 2107 ft | 3G1 / SILVER SPRING |
| 1200 BLK SPRING ST | 2026-05-31 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 2767 ft | 3G1 / SILVER SPRING |
| 1200 BLK KATHRYN RD | 2026-06-01 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 2927 ft | 3I1 / SILVER SPRING |
| 400 BLK LINCOLN AVE | 2026-05-30 18:00-00:00 | Stolen Vehicle | 900 BLK SILVER SPRING AVE | 8229 ft | 8T3 / TAKOMA PARK |
| 100 BLK LEXINGTON DR | 2026-05-31 12:00-18:00 | Theft From Auto | 900 BLK SILVER SPRING AVE | 10574 ft | 3I3 / SILVER SPRING |
| 12700 BLK SUMMERWOOD DR | 2026-06-01 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 15359 ft | 3I1 / SILVER SPRING |
| 7100 BLK WISCONSIN AVE | 2026-05-31 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 18434 ft | 2D2 / BETHESDA |

## Forecast 2026-05-29

Forecast window: 2026-05-29 through 2026-06-01
Actual matching incidents: 39

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 39 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 22 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 17 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 5.1% / 4.0% | 5.1% / 15.8% | 5.1% / 15.8% |
| Theft From Auto | 0.0% / 0.0% | 9.1% / 4.0% | 9.1% / 8.0% | 9.1% / 20.0% | 9.1% / 20.0% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 5.9% / 4.8% | 5.9% / 4.8% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 39 | 0 (0.0%) | 0 (0.0%) | 2 (5.1%) | 3 (7.7%) | 5 (12.8%) | 37400 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 8000 BLK EASTERN AVE | 2026-05-31 12:00-18:00 | Stolen Vehicle | 1100 BLK BONIFANT ST | 1898 ft | 3G1 / SILVER SPRING |
| 8700 BLK CAMERON ST | 2026-05-31 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 2107 ft | 3G1 / SILVER SPRING |
| 1200 BLK SPRING ST | 2026-05-31 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 2767 ft | 3G1 / SILVER SPRING |
| 400 BLK LINCOLN AVE | 2026-05-30 18:00-00:00 | Stolen Vehicle | 900 BLK SILVER SPRING AVE | 8229 ft | 8T3 / TAKOMA PARK |
| 100 BLK LEXINGTON DR | 2026-05-31 12:00-18:00 | Theft From Auto | 900 BLK SILVER SPRING AVE | 10574 ft | 3I3 / SILVER SPRING |
| 7100 BLK WISCONSIN AVE | 2026-05-31 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 18434 ft | 2D2 / BETHESDA |
| 2300 BLK RANDOLPH RD | 2026-05-29 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 18822 ft | 4L1 / WHEATON |
| 4900 BLK CORDELL AVE | 2026-05-30 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 19855 ft | 2D2 / BETHESDA |

## Forecast 2026-05-28

Forecast window: 2026-05-28 through 2026-05-31
Actual matching incidents: 42

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 42 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 29 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 13 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 2.4% / 4.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 7.7% / 4.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 42 | 0 (0.0%) | 0 (0.0%) | 1 (2.4%) | 0 (0.0%) | 4 (9.5%) | 41323 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 8900 BLK GEORGIA AVE | 2026-05-28 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 1689 ft | 3G2 / SILVER SPRING |
| Unknown location | 2026-05-28 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 4840 ft | 3G2 / SILVER SPRING |
| 1100 BLK DUNOON RD | 2026-05-28 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 6353 ft | 3I3 / SILVER SPRING |
| 400 BLK LINCOLN AVE | 2026-05-30 18:00-00:00 | Stolen Vehicle | 900 BLK SILVER SPRING AVE | 8229 ft | 8T3 / TAKOMA PARK |
| 7600 BLK HAMMOND AVE | 2026-05-28 18:00-00:00 | Theft From Auto | 900 BLK SILVER SPRING AVE | 10477 ft | 8T3 / TAKOMA PARK |
| 1100 BLK DEVERE DR | 2026-05-28 12:00-18:00 | Theft From Auto | 900 BLK SILVER SPRING AVE | 14951 ft | 3I3 / SILVER SPRING |
| 2300 BLK RANDOLPH RD | 2026-05-29 18:00-00:00 | Theft From Auto | 11500 BLK LOCKWOOD DR | 18822 ft | 4L1 / WHEATON |
| 4900 BLK CORDELL AVE | 2026-05-30 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 19855 ft | 2D2 / BETHESDA |

## Forecast 2026-05-26

Forecast window: 2026-05-26 through 2026-05-29
Actual matching incidents: 52

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 52 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 33 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 19 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 1.9% / 4.0% | 3.9% / 16.0% | 1.9% / 5.3% | 1.9% / 5.3% |
| Theft From Auto | 0.0% / 0.0% | 3.0% / 4.0% | 3.0% / 8.0% | 3.0% / 6.7% | 3.0% / 6.7% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 5.3% / 4.0% | 5.3% / 4.3% | 5.3% / 4.3% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 52 | 0 (0.0%) | 1 (1.9%) | 2 (3.8%) | 2 (3.8%) | 12 (23.1%) | 29400 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 100 BLK HIGH PARK LA | 2026-05-26 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 1448 ft | 3G1 / SILVER SPRING |
| 8900 BLK GEORGIA AVE | 2026-05-28 18:00-00:00 | Stolen Vehicle | 8500 BLK CAMERON ST | 1689 ft | 3G2 / SILVER SPRING |
| 11500 BLK FEBRUARY CIR | 2026-05-27 18:00-00:00 | Stolen Vehicle | 11500 BLK LOCKWOOD DR | 3116 ft | 3I1 / SILVER SPRING |
| 1100 BLK DUNOON RD | 2026-05-28 18:00-00:00 | Theft From Auto | 9700 BLK MT PISGAH RD | 4542 ft | 3I3 / SILVER SPRING |
| Unknown location | 2026-05-28 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 4840 ft | 3G2 / SILVER SPRING |
| 9600 BLK SUTHERLAND RD | 2026-05-27 18:00-00:00 | Theft From Auto | 800 BLK ELLSWORTH DR | 4950 ft | 3G2 / SILVER SPRING |
| 10000 BLK RENFREW RD | 2026-05-26 18:00-00:00 | Theft From Auto | 800 BLK ELLSWORTH DR | 7603 ft | 3I3 / SILVER SPRING |
| 8700 BLK BARRON ST | 2026-05-27 18:00-00:00 | Theft From Auto | 800 BLK ELLSWORTH DR | 7915 ft | 3G3 / SILVER SPRING |

## Forecast 2026-05-22

Forecast window: 2026-05-22 through 2026-05-25
Actual matching incidents: 33

| Group | Actual Incidents | Selected Cells | Model Hit Rate | Baseline Hit Rate | Precision | Brier | PAI | False Positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combined | 33 | 25 | 0.0% | 0.0% | 0.0% | 0.002 | 0.00 | 25 |
| Theft From Auto | 18 | 25 | 0.0% | 0.0% | 0.0% | 0.001 | 0.00 | 25 |
| Stolen Vehicle | 15 | 25 | 0.0% | 0.0% | 0.0% | 0.000 | 0.00 | 25 |

#### Broader Model Scoring

| Group | 6h Exact | 6h/1,500 ft | 6h/2,250 ft | 12h/1,500 ft | 24h/1,500 ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Theft From Auto | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| Stolen Vehicle | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |

#### Combined-Risk Miss Distance

| Actual Incidents | Exact Cell | Within 1,500 ft | Within 2,250 ft | Same Beat | Same District | Median Nearest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 33 | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 1 (3.0%) | 2 (6.1%) | 55154 ft |

#### Closest Same-Window Actuals

| Actual Location | Window | Offense | Nearest Forecast Area | Distance | Actual Beat/District |
| --- | --- | --- | --- | ---: | --- |
| 7800 BLK EASTERN AVE | 2026-05-23 12:00-18:00 | Theft From Auto | 1100 BLK BONIFANT ST | 2926 ft | 3G1 / SILVER SPRING |
| 9400 BLK GARWOOD ST | 2026-05-24 18:00-00:00 | Stolen Vehicle | 800 BLK ELLSWORTH DR | 7695 ft | 3G2 / SILVER SPRING |
| 6800 BLK NEW HAMPSHIRE AVE | 2026-05-22 12:00-18:00 | Theft From Auto | 900 BLK SILVER SPRING AVE | 10752 ft | 8T3 / TAKOMA PARK |
| 3300 BLK JONES BRIDGE RD | 2026-05-23 12:00-18:00 | Stolen Vehicle | 1100 BLK BONIFANT ST | 10977 ft | 2D1 / BETHESDA |
| 10500 BLK CASCADE PL | 2026-05-24 18:00-00:00 | Stolen Vehicle | 8700 BLK CAMERON ST | 11212 ft | 4L2 / WHEATON |
| 2500 BLK GLENALLAN AVE | 2026-05-22 18:00-00:00 | Theft From Auto | 8700 BLK CAMERON ST | 24638 ft | 4L3 / WHEATON |
| 4100 BLK RANDOLPH RD | 2026-05-22 12:00-18:00 | Theft From Auto | 800 BLK ELLSWORTH DR | 26370 ft | 4L3 / WHEATON |
| 4400 BLK GRIDLEY RD | 2026-05-24 18:00-00:00 | Stolen Vehicle | 8700 BLK CAMERON ST | 26550 ft | 4L3 / WHEATON |

## How To Read This

- Hit rate is the share of actual incidents captured by the selected forecast cells.
- Precision is the share of selected forecast cells that had at least one actual incident.
- Baseline compares the model to a simple recent-hot-spots approach.
- Brier score is probability error; lower is better.
- PAI is concentration efficiency; higher is better.
- False positives are selected forecast cells with no matching incident.
- Broader scores ask whether the same predictions would have helped within a larger patrol area or longer time window.
- Miss distance measures how far same-window actual incidents were from the nearest selected combined-risk cell.

