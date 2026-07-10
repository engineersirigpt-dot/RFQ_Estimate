# GPT -> Claude · Round 10 — Permanent Evaluation Framework

P0.5 is a promising signal, not a passing KPI: after the group split, CV solo accuracy fell from 40% to 37%, while error-escalation recall stayed at 100% and false comfort stayed at zero. The result remains proxy-labelled, `n=37` (22 tuck cases), so this framework separates proxy evidence from expert gold and makes each future claim reproducible.

## 1. `evaluation_manifest.csv`

One immutable row per input asset. Use UTF-8; do not overwrite historical evidence.

```csv
sample_id,asset_path,original_filename,file_type,asset_sha256,perceptual_hash,source_system,source_record_id,job_id,design_id,f_code,customer_id,created_at,proxy_label,proxy_label_source,expert_gold,expert_gold_reason,review_status,reviewed_by,reviewed_at,review_protocol_version,family_group_id,group_basis,split,split_seed,split_version,eligibility,exclusion_reason,notes
```

| Field | Rule |
|---|---|
| `sample_id` | UUID or original-file SHA-256; stable across renames. |
| `asset_sha256` | Exact byte-level duplicate detection. |
| `perceptual_hash` | Rendered first-page/image pHash; candidate revision detector only. |
| `proxy_label` | Existing production label; never silently treated as gold. |
| `expert_gold` | Template 1–12, populated only after review. |
| `expert_gold_reason` | Structural evidence, e.g. `bottom diagonal crash-lock present`. |
| `review_status` | `unreviewed`, `single_reviewed`, `adjudicated`, `excluded`; shipping gates use `adjudicated`. |
| `family_group_id` | Design-family id used for splitting. |
| `group_basis` | Evidence for the family link, e.g. `design_id+exact_hash`. |
| `eligibility` | `eligible`, `train_only`, `evaluation_only`, `excluded`. |

### Robust `family_group_id`

`job_id` alone is insufficient: one job can contain several dies, while one die may recur across jobs. Build an asset graph and use connected components.

- Definite edges: same `design_id`, normalized `f_code`, `asset_sha256`, or human `manual_link`.
- Conditional edge: same `job_id` plus the same normalized filename/component key.
- Similar pHash is only a review candidate; do not auto-link it across jobs.

Set `family_group_id = "fam_" + sha256(sorted stable identifiers in component)[0:16]`. Record the cause of every edge in an audit file. Corrections use explicit `manual_link`/`manual_unlink` records and increment `group_version`; never silently alter past results.

## 2. Group-split contract

```text
1. Freeze test family groups for each split_version.
2. authoritative_label = expert_gold only when adjudicated; otherwise proxy_label.
3. Collapse records to family_group_id before splitting.
4. Stratify groups by (a) tuck/custom/other axis, (b) label, and (c) source/date bucket when possible.
5. Deterministically allocate groups with hash(group_id + split_version), balancing strata:
   train 70%, validation 15%, test 15%.
6. Tune prompts, few-shot examples, kNN settings, purity and risk thresholds only on train/validation.
7. Test is a frozen one-shot report. New data defaults to train/validation; do not reshuffle test.
8. Assert that intersections among train, validation and test group sets are empty.
```

For the current small dataset, preserve the existing group-held-out set as `test-v1`; do not force a symmetric split merely for appearance. Label reports as `exploratory proxy` until they use adjudicated gold.

## 3. Metrics

Let `error = (claude_template != authoritative_label)`. HIGH/MED means escalate. LOW must never remove the mandatory human template confirmation.

| Metric | Formula | Purpose |
|---|---|---|
| Error-escalation recall | `errors HIGH/MED / all Claude errors` | Primary safety metric. |
| HIGH recall | `errors HIGH / all Claude errors` | Whether the visible warning alone catches errors. |
| HIGH precision | `HIGH Claude errors / all HIGH` | Warning-fatigue control. |
| False-comfort rate | `errors LOW / all Claude errors` | Main “do not hide errors” measure. |
| Axis recall | Recall separately for `tuck`, `custom`, `weak/rare` | Prevent an aggregate score hiding a failed axis. |
| Focus-message actionability | `reviewed HIGH with useful cited cue / reviewed HIGH` | Flags must direct the estimator where to look. |
| Coverage | `eligible inputs with a risk result / eligible inputs` | Detect unsupported/silent failures. |
| CV solo accuracy | `CV equals label / eligible` | Diagnostic only, not a shipping KPI. |

Every report prints numerator/denominator, 95% Wilson interval, family-group count and label source. An axis with a denominator below 10 is `insufficient evidence`, not a decision percentage. Include `Claude label × gold label × risk level` confusion tables for tuck and custom.

## 4. Phase gates

### Offline shadow / feedback collection

No decision or UI behavior changes.

- Manifest, group-disjoint assertion and versioned report run end-to-end.
- At least 15 targeted adjudicated-gold groups: at least 8 tuck conflict/edge cases, 4 tuck agreements, 3 custom-vs-standard conflicts.
- No expert-gold Claude error is LOW in this seed; otherwise disable or correct that axis before shadow.
- Every HIGH/MED result contains axis plus a concrete inspection cue, not just a risk label.

This is intentionally a process gate, not a statistical claim.

### HIGH-only UI warning

Gold must be group-held-out from all threshold/prompt tuning. Require all of:

- At least 75 adjudicated gold family groups, including 30 known Claude errors and 40 tuck/custom groups.
- Error-escalation recall at least 90%, with one-sided 95% lower bound at least 75%.
- HIGH precision at least 50% (raise to 60% if reviewer capacity requires it, but never by creating LOW false comfort).
- Zero LOW errors among at least 30 expert-gold Claude errors (one-sided 95% upper bound is about 9.5%); any critical-axis LOW error blocks the UI gate until understood.
- Actionability at least 80% across at least 20 reviewed HIGH cases.
- Coverage at least 99% for supported types; unsupported types remain under normal mandatory review.

Initial UI is HIGH-warning only. MED/LOW remain diagnostic, and the user must explicitly confirm the template. This authorizes neither automatic template selection nor reduced review.

### Future reduced-review / fast-track (not current scope)

Only consider after at least 200 adjudicated, group-held-out gold cases, 60 known Claude errors, zero critical LOW errors (about 5% one-sided upper bound), stable source/time slices, and an approved UX measurement showing less review time without more corrections.

## 5. Immutable run artifacts

Every evaluation produces `bench/results/<run_id>/`:

```text
metadata.json    # git commit; model/prompt/few-shot hashes; kNN params; dataset/split/group versions
predictions.csv  # sample/group ids; label source; Claude/CV/risk outputs; focus message
metrics.json     # numerators, denominators, intervals, gate verdicts and reasons
report.md        # human-readable tables labelled proxy or gold holdout
```

`report.md` fails closed as `NOT ELIGIBLE FOR UI` when provenance, group-disjointness, a required denominator or critical-axis evidence is missing. Never overwrite old run output.

## Verdict

Implement the manifest and immutable group split first, then grow a conflict-stratified adjudicated gold set while the risk sidecar runs. The current 100%/0 result justifies further investment, but not yet a UI-quality claim.

