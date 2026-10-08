# Validation-gate timing (adviser W3 #3)

The seven-check, fail-closed data validation (`GET /api/check/<run>`, journal `stage.check.start`..`stage.check.end`) timed alone, on groundtruth-mode populations (no cryptography), between capstone runs on an idle network. Seconds are the console's own `mono_ms` for the check stage; each tier was checked three times.

| Tier | Voters (table rows) | Ballot records | Check s (median of 3) | Rows per second | Run |
|---|---|---|---|---|---|
| SP-1K | 1,000 | 1,000 | 0.055 | 18,182 | `sp-1k-ch4-gate-20261001-101851-2` |
| SP-10K | 10,000 | 10,000 | 0.056 | 178,571 | `sp-10k-ch4-gate-20261001-101857-3` |
| SP-50K | 50,000 | 50,000 | 0.064 | 781,250 | `sp-50k-ch4-gate-20261001-101903-4` |
| SP-483K | 483,000 | 483,000 | 0.158 | 3,056,962 | `sp-483k-ch4-gate-20261001-101909-5` |
| SP-1M | 1,000,000 | 1,000,000 | 0.208 | 4,807,692 | `sp-1m-ch4-gate-20261001-101915-6` |
| SP-1.92M | 1,921,917 | 1,921,917 | 0.481 | 3,995,669 | `sp-1-92m-ch4-gate-20261001-101921-7` |
| SP-3.5M | 3,524,078 | 3,524,078 | 0.800 | 4,405,098 | `sp-3-5m-ch4-gate-20261001-101929-8` |
| MP-1K | 1,000 | 3,000 | 0.004 | 250,000 | `mp-1k-ch4-gate-20261001-101942-9` |
| MP-10K | 10,000 | 30,000 | 0.007 | 1,428,571 | `mp-10k-ch4-gate-20261001-101948-10` |
| MP-50K | 50,000 | 150,000 | 0.019 | 2,631,579 | `mp-50k-ch4-gate-20261001-101954-11` |
| MP-483K | 483,000 | 1,449,000 | 0.178 | 2,713,483 | `mp-483k-ch4-gate-20261001-102000-12` |
| MP-1M | 1,000,000 | 3,000,000 | 0.309 | 3,236,246 | `mp-1m-ch4-gate-20261001-102006-13` |
| MP-1.92M | 1,921,917 | 5,765,751 | 0.558 | 3,444,296 | `mp-1-92m-ch4-gate-20261001-102013-14` |
| MP-3.5M | 3,524,078 | 10,572,234 | 0.848 | 4,155,752 | `mp-3-5m-ch4-gate-20261001-102020-15` |
