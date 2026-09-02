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
- [x] The Globals Gate is implemented with the public ESLint `Linter` API and a closed 38-included/7-excluded/45-discovered inventory.
- [x] `npm run test:gate:globals` validates the gate implementation; `npm run qa:globals` executes it against the repository.
- [ ] The implemented Globals Gate reports zero unresolved bundle collisions and zero blocked dynamic constructions.
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
- [ ] The historical 299-test session is reconciled against the canonical 233-test inventory by the identity, repository-relative path, and expected count of every suite, not merely by aggregate total.
- [ ] Current-run JSON evidence is valid and sanitized, its declared/discovered/executed inventories are identical, no suite is omitted, and all required static gates pass.
- [ ] All controls in the Engineering Standard gate table are implemented and versioned.
- [ ] Every structural blocker is closed by linked, immutable evidence.
- [ ] Topology-specific rollback rehearsals succeed.

## 4. Baseline evidence

The **299 passed, 0 failed, 299 total** result was session evidence executed locally on **2026-08-24** against revision `ef8b0ecc764a8429d2c3e46c2b47b91a30994090` (`ef8b0ec`). It is retained exclusively as historical, non-reproducible evidence. The difference is 66: `299 = 233 + 66`. This is compatible with a probable double count of the 66-test AERP-038A wrapper suite, but primary evidence does not prove that explanation.

The canonical reconciled baseline is **233 passed, 0 failed, 233 total**, produced by `npm test` from these exact suite identities and repository-relative paths:

| Suite path                                                    | Expected tests |
| ------------------------------------------------------------- | -------------- |
| `AERP-036_AuthorizationEngine.test.js`                        | 14             |
| `AERP-038A_MetadataBuilderEnterprise.test.js`                 | 40             |
| `AERP-038A_MetadataBuilderEnterpriseWrapper.test.js`          | 66             |
| `AERP-038B_SingleMetadataBuildConsumerIntegration.test.js`    | 51             |
| `AERP-038B_SingleMetadataBuildPipelineIntegration.test.js`    | 34             |
| `AERP-038B_SingleMetadataBuildOperationalIntegration.test.js` | 28             |
| **Total**                                                     | **233**        |

Acceptance requires valid current-run JSON evidence, exact declared/discovered/executed inventory equality, zero omitted suites, and passing required static gates. The Phase 1 executable gate is implemented, versioned, and technically approved, but AERP-QA-001 is not closed because other gates, release evidence, and product blocker resolution remain pending.

The 233/233 baseline MUST NOT be the primary or sole acceptance criterion. Test identity, required risk coverage, exact inventory, static gates, and artifact equivalence are controlling. A count change requires reconciliation; equal or higher counts do not prove acceptance or guarantee absence of defects.

## 5. Phase 2 Globals Gate status

The Globals Gate implementation is **Implemented / Active** and its execution is valid. It is parser-backed through the public ESLint `Linter` API. The operational command is `npm run qa:globals`; its self-test command is `npm run test:gate:globals`.

The closed inventory contains 38 included files, 7 excluded files, and 45 discovered files. The current valid execution reports 758 unique global symbols, 781 occurrences, three duplicate symbols, and seven blocking dynamic constructions. Its expected repository result is exit `1 / STRUCTURAL_BLOCKERS`: this proves that the gate detects the current blockers, not that the repository passed it.

The blockers are `aerpAuthorize` (`incompatible-public-entrypoint`, CRITICAL), `AERP_AUTHORIZATION_VERSION` (`equivalent-duplicate`, HIGH), `aerpMetadataToRow` (`equivalent-duplicate`, HIGH), and seven productive `eval` uses rejected by the fail-closed policy. Their correction is separate product work and remains pending.

Local execution evidence is `.qa-output/globals-evidence.json`, schema `1.1.0`. It is ephemeral, revision-bound and `runId`-bound, regenerated on every run, ignored by Git, and not reusable for another review. External, versioned or immutable release evidence remains Future / Pending.

The closed IPC `READY`/`INTERRUPT` contract produces real Windows child exits 130 for controlled SIGINT and 143 for controlled SIGTERM, both with `signal=null`. Persistence or a sanitized diagnostic completes first, and persistence failure preserves the contractual exit. Self-tests record 37 passes and one deliberate POSIX-only skip on Windows. Real POSIX signal coverage remains Future / Pending on a POSIX platform.

## 6. Traceability matrix

| Requirement                                      | Gate                | Command/control                                            | Required evidence                                           | Current state                                                                                                  | Blocker                 |
| ------------------------------------------------ | ------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Canonical authorization API                      | Contract/security   | `npm run test:target -- AERP-039` plus security review     | Contract report and approval                                | Pending                                                                                                        | BLOCKER-01              |
| Globals Gate implementation                      | Globals Gate        | `npm run test:gate:globals`                                | Approved parser-backed self-test report                     | Implemented / Active; 37 pass, 1 POSIX skip on Windows                                                         | None for implementation |
| Zero global collisions and dynamic constructions | Globals Gate        | `npm run qa:globals`                                       | Local schema-1.1.0 JSON evidence; release retention pending | Valid execution; repository blocked at `1 / STRUCTURAL_BLOCKERS` with 3 collisions and 7 dynamic constructions | BLOCKER-01/02           |
| Globals release evidence                         | Evidence retention  | Clean-checkout CI or approved external retention           | Versioned or immutable revision-bound record                | Future / Pending                                                                                               | BLOCKER-05/07           |
| Resolve detected product blockers                | Product change      | Separate approved work item and contract/security tests    | One owner per duplicate; zero blocked dynamic constructions | Pending; outside this documentation update                                                                     | BLOCKER-01/02           |
| Positive deployable set                          | Bundle manifest     | `npm run bundle:manifest:check`                            | Manifest, sorted listing, hashes, order                     | Pending                                                                                                        | BLOCKER-03              |
| Exclude Node/test files                          | Bundle manifest     | Exact comparison against positive allowlist                | Exclusion proof for seven named files                       | Pending                                                                                                        | BLOCKER-03              |
| Reproducible full suite                          | Full suite          | `npm test`                                                 | Canonical JSON report and exact inventory                   | Technical pass; joint review pending                                                                           | BLOCKER-04/05/07        |
| Zero lint warnings                               | Lint                | `eslint . --max-warnings=0`                                | Exit code and log                                           | Pending                                                                                                        | BLOCKER-05              |
| Reviewed whitespace                              | Diff                | `git diff --check <approved-base>...HEAD`                  | Resolved range and output                                   | Pending                                                                                                        | BLOCKER-05              |
| No unknown files                                 | Untracked inventory | `git ls-files --others --exclude-standard` plus comparison | Sorted list and approval                                    | Pending                                                                                                        | BLOCKER-05              |
| Exact artifact integrity                         | Bundle test         | `npm run test:bundle`                                      | Artifact hash and test report                               | Pending                                                                                                        | BLOCKER-04              |
| Recover every runtime path                       | Rollback rehearsal  | Topology-specific controlled exercise                      | Four-path recovery record                                   | Pending                                                                                                        | BLOCKER-06              |

## 7. References

The official source registry and consultation date **2026-08-24** are defined in the Engineering Standard. Applicable authorities are Google Apps Script V8/deployment/version documentation, clasp configuration, Git, ESLint, NIST SP 800-218/SP 800-53, and OWASP authorization/secure-deployment guidance.
