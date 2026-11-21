# Evaluation and validation

## Booking correctness

Use deterministic unit cases for Johannesburg midnight, same-day past times, exact-now rejection, timezone-free values, invalid calendar dates, configured hours, inactive accounts and overlap/adjacent reservations. API tests verify friendly 400/409 errors and unique-key race handling. Frontend browser checks deliberately emulate America/Los_Angeles while submitting a SAST appointment.

The opt-in MongoDB integration test is essential before production: mocked tests cannot prove a real unique multikey index or a geospatial aggregation. Configure a separate confirmed `localtrust_test_*` database as documented in README. Also stress at least 50 simultaneous requests for the same provider/time: require exactly one reservation, all others 409, and no remaining duplicate active appointments. Test cancellations freeing minutes and acceptance of a reschedule releasing old minutes. Do not run writes against existing production data.

Existing records without occupied-minute arrays are protected by the conflict lookup. Their already-existing overlaps are not silently repaired. If other tools write bookings outside the application, they must apply the same reservation convention. Reservations are currently one hour; multi-hour services need explicit duration modelling before launch.

## Top-5 matching quality (not yet measured)

Baseline is deterministic ranking, not ML. Score weights: category exact match 35 (15 when unspecified), distance up to 20 within 50km, selected-date working hours 20 (10 when no date), verified provider 10, approved rating up to 10, relevant completed bookings up to 5. Unknown distance contributes zero rather than an invented location. Eligible records are prefiltered by active status and supplied filters; date-specific conflicts are excluded. Ties use stable provider IDs, and repeated services from one provider are deduplicated. Candidate queries currently cap at 100 records. UI date-free recommendations do not promise an appointment slot.

Collect at least 100 representative consented/anonymised requests across categories, locations, budgets and time windows. Have two independent assessors label candidate suitability without seeing ranking scores; adjudicate disagreements. Split by customer/time to avoid leakage and keep a held-out test set. Report Precision@5, Recall@5 where the eligible pool is labelled, nDCG@5, zero-result rate and confidence intervals. Compare category-only, distance-only and full weighted baselines. Audit region/category coverage and popularity bias. Report sample sizes and disagreements. No result is available yet.

## Review-risk precision target (not yet measured)

The four current text rules are triage signals; neither a rule nor a high score proves fraud. All new reviews wait for human moderation regardless of score. No automatic deletion exists.

Define a positive as a review independently confirmed to violate the review policy, not merely one flagged by a rule. Build a de-identified labelled set of genuine and confirmed abusive reviews, stratified by score, language, review length and category. Use two reviewers and adjudication. Separate repeated customers/bookings across train/tuning and held-out sets. Tune a queue threshold using only the tuning split. At the proposed operating threshold, calculate precision = TP/(TP+FP), recall, false-positive rate, queue size and a 95% confidence interval. The target is at least 75% precision on held-out data; do not claim it until measured with adequate sample size. Report low-recall tradeoffs and false positives (short genuine reviews, multilingual text, accessibility-related writing styles). Preserve the original review for appeal.

## Current test scope

Automated unit/API checks cover auth contracts, suspension, roles/ownership, service validation, directory query construction, booking validation and transitions, conflict responses, recommendation ranking, mocked AI assistant, listing retrieval and outage fallback, payment simulation/receipt idempotency, moderation, notifications, profile hours, email adapter mocks and additive seed guards/idempotence. No paid AI, gateway or email calls run.

Browser fixtures verify layout and common controls, not real database persistence. Screenshots are test artifacts, not evidence of real providers or transactions. The optional read-only smoke check against the running API does not prove that server process has loaded the changed routes; restart the backend before a manual integration walkthrough.
