# AERP-QA-001 — Definition of Done

## 1. Governing status

The documents may specify gates before their implementations exist. AERP-QA-001 is **not done** until every mandatory gate is executable, versioned, reproducible, and passing against the exact candidate artifact.

Current disposition: **NO-GO**. AERP-039 may not proceed.

## 2. Change-level checklist

### Scope and implementation

- [ ] Work item, acceptance criteria, affected contracts, risks, and rollback topology are documented.
- [ ] No unrelated file is modified.
- [ ] Every affected global symbol has one canonical owner.
- [ ] Public APIs have versioned contracts and named compatibility adapters where approved.
- [ ] Security-sensitive paths fail closed and preserve tenant isolation.
- [ ] Test-only and Node-only code is excluded from the positive Apps Script bundle.

### Executable verification

- [ ] Targeted and full-suite commands are implemented and versioned.
- [ ] Positive, negative, boundary, regression, and security tests pass.
- [ ] `eslint . --max-warnings=0` passes.
- [ ] Prettier check covers the exact reviewed inventory.
- [ ] `git diff --check <approved-base>...HEAD` passes using resolved revisions.
- [ ] A separate untracked-file inventory is empty or matches the approved list exactly.
- [ ] The global-symbol scanner covers functions, classes, variables, constants, and `globalThis` assignments and reports zero unresolved bundle collisions.
- [ ] The positive bundle manifest, reproducible sorted file list, exclusion policy, and controlled `filePushOrder` agree exactly.
- [ ] The exact artifact passes contract, integration, runtime, and security smoke tests.
- [ ] Evidence contains command/control, inputs, output, responsible person, timestamp, tool versions, revision, artifact hash, and failure criteria.

### Review and recovery

- [ ] Technical and security reviews are approved.
- [ ] Deployment topology is inventoried.
- [ ] Rollback is rehearsed separately for versioned deployments, HEAD execution, menus/custom functions, and simple/installable triggers.
- [ ] A known-good immutable version and a validated HEAD restoration procedure are recorded.
- [ ] Release owner, validator, approvers, decision window, and evidence location are recorded.

## 3. AERP-QA-001 exit criteria

- [ ] One canonical `aerpAuthorize` contract is approved and implemented without duplicate ownership.
- [ ] Duplicate `AERP_AUTHORIZATION_VERSION` ownership is consolidated.
- [ ] Duplicate `aerpMetadataToRow` ownership is consolidated.
- [ ] Named compatibility paths have contract tests.
- [ ] The complete production-global inventory reports zero unresolved collisions.
- [ ] A positive deployable manifest is authoritative and versioned.
- [ ] `eslint.config.js` and all six `*.test.js` files are verifiably excluded from publication.
- [ ] Production-embedded test entry points are removed or excluded with exact-artifact evidence.
- [ ] Canonical file order and `filePushOrder`, where applicable, are approved and tested.
- [ ] The exact candidate artifact, rather than isolated source families, passes all gates.
- [ ] The 299-test session baseline is reconciled by test identity and risk coverage, not just count.
- [ ] All controls in the Engineering Standard gate table are implemented and versioned.
- [ ] Every structural blocker is closed by linked, immutable evidence.
- [ ] Topology-specific rollback rehearsals succeed.

## 4. Baseline evidence

The **299 passed, 0 failed, 299 total** result was session evidence executed locally on **2026-08-24** against revision `ef8b0ecc764a8429d2c3e46c2b47b91a30994090` (`ef8b0ec`). It is informative evidence, but it is not yet reproducible or versioned through a canonical repository command and report.

The baseline MUST NOT be the primary acceptance criterion. Test identity, required risk coverage, exact inventory, and artifact equivalence are controlling. A count change requires reconciliation; equal or higher counts do not prove acceptance.

## 5. Traceability matrix

| Requirement                 | Gate                | Future command/control                                     | Required evidence                       | Current state | Blocker          |
| --------------------------- | ------------------- | ---------------------------------------------------------- | --------------------------------------- | ------------- | ---------------- |
| Canonical authorization API | Contract/security   | `npm run test:target -- AERP-039` plus security review     | Contract report and approval            | Pending       | BLOCKER-01       |
| Zero global collisions      | Global audit        | `npm run audit:globals`                                    | Complete symbol inventory               | Pending       | BLOCKER-01/02    |
| Positive deployable set     | Bundle manifest     | `npm run bundle:manifest:check`                            | Manifest, sorted listing, hashes, order | Pending       | BLOCKER-03       |
| Exclude Node/test files     | Bundle manifest     | Exact comparison against positive allowlist                | Exclusion proof for seven named files   | Pending       | BLOCKER-03       |
| Reproducible full suite     | Full suite          | `npm run test:all`                                         | Canonical report and inventory          | Pending       | BLOCKER-04/05/07 |
| Zero lint warnings          | Lint                | `eslint . --max-warnings=0`                                | Exit code and log                       | Pending       | BLOCKER-05       |
| Reviewed whitespace         | Diff                | `git diff --check <approved-base>...HEAD`                  | Resolved range and output               | Pending       | BLOCKER-05       |
| No unknown files            | Untracked inventory | `git ls-files --others --exclude-standard` plus comparison | Sorted list and approval                | Pending       | BLOCKER-05       |
| Exact artifact integrity    | Bundle test         | `npm run test:bundle`                                      | Artifact hash and test report           | Pending       | BLOCKER-04       |
| Recover every runtime path  | Rollback rehearsal  | Topology-specific controlled exercise                      | Four-path recovery record               | Pending       | BLOCKER-06       |

## 6. References

The official source registry and consultation date **2026-08-24** are defined in the Engineering Standard. Applicable authorities are Google Apps Script V8/deployment/version documentation, clasp configuration, Git, ESLint, NIST SP 800-218/SP 800-53, and OWASP authorization/secure-deployment guidance.
