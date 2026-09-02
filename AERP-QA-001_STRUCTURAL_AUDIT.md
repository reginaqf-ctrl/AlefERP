# AERP-QA-001 — Structural Audit

## 1. Executive summary

The repository is **not structurally releasable**. A prior non-reproducible session recorded 299/299, while the Phase 1 canonical test gate establishes a reproducible 233/233 baseline. Phase 2 implements an approved parser-backed Globals Gate, whose valid execution blocks the repository with three duplicate symbols and seven dynamic constructions. The deployable surface remains uncontrolled, the exact bundle is untested, additional mandatory gates remain absent, and rollback coverage is incomplete.

Release disposition: **NO-GO**. AERP-039 may not proceed.

## 2. Evidence basis and limitation

The **299 passed, 0 failed, 299 total** result was executed locally during a prior session on **2026-08-24** against commit `ef8b0ecc764a8429d2c3e46c2b47b91a30994090`. It is retained exclusively as historical, non-reproducible session evidence and is not an acceptance baseline.

Phase 1 now provides the canonical, reconciled, reproducible baseline: **233 passed, 0 failed, 233 total** through `npm test`. The command executes six explicit Node processes and writes sanitized JSON evidence to `.qa-output/test-evidence.json`. The historical difference is 66: `299 = 233 + 66`. This is compatible with a probable double count of the 66-test AERP-038A wrapper suite, but it is not proven by primary evidence.

Repository facts were verified directly from the current files. Tool/runtime statements use the official references in section 8, consulted 2026-08-24.

Phase 2 provides the **Implemented / Active** Globals Gate. `npm run qa:globals` executes the closed 38-included/7-excluded/45-discovered inventory through the public ESLint `Linter` API; `npm run test:gate:globals` tests the gate. The current valid execution reports 758 unique global symbols, 781 occurrences, three duplicate symbols, seven blocked dynamic constructions, and exit `1 / STRUCTURAL_BLOCKERS`. The implementation is approved and the execution is valid, but the repository result is blocked.

Its local evidence, `.qa-output/globals-evidence.json` schema `1.1.0`, is ephemeral, revision-bound and `runId`-bound, regenerated on every execution, ignored by Git, and not reusable for another review. External, versioned or immutable release retention remains Future / Pending.

## 3. Complete known production collision inventory

| Symbol                       | Evidence                                                                                                                 | Comparison                                                                      | Classification                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `aerpAuthorize`              | `36_AuthorizationEngine.js:121`; `AERP-036_AuthorizationEngine.js:391` and explicit `globalThis` assignment at line 1003 | `(request, options)` versus `(context, model)` and different decision semantics | `incompatible-public-entrypoint`, CRITICAL |
| `AERP_AUTHORIZATION_VERSION` | `36_AuthorizationEngine.js:38`; `AERP-036_AuthorizationEngine.js:52`, exported at line 1009                              | Both currently appear to hold `1.0.0`                                           | `equivalent-duplicate`, HIGH               |
| `aerpMetadataToRow`          | `04_ActionEngine.js:148`; `07_Writer.js:170`                                                                             | Same apparent signature and body                                                | `equivalent-duplicate`, HIGH               |

Apparently equivalent duplicates remain blockers because either copy can diverge and ownership is ambiguous. The implemented parser-backed gate confirms this as the complete current exact-collision set. Product consolidation remains pending.

## 4. Blocking findings

### BLOCKER-01 — Incompatible authorization entry point (CRITICAL)

Two global `aerpAuthorize` contracts occupy the Apps Script global scope. The runtime caller can receive the wrong validation and decision contract. Required closure: approve one contract, consolidate ownership, use only named adapters, add contract/security tests, and verify the exact artifact.

### BLOCKER-02 — Additional duplicate global ownership (HIGH)

`AERP_AUTHORIZATION_VERSION` and `aerpMetadataToRow` have duplicate owners. Their implementations appear equivalent today, but violate the canonical-owner rule. Required closure: consolidate each symbol and pass the complete global scan.

### BLOCKER-03 — Uncontrolled clasp publication surface (CRITICAL)

`.clasp.json` uses the repository root, accepts `.js`, has empty `filePushOrder`, and there is no `.claspignore`. Until a positive exclusion is verified, the potential publication set includes `eslint.config.js` and exactly six Node test files:

1. `AERP-036_AuthorizationEngine.test.js`
2. `AERP-038A_MetadataBuilderEnterprise.test.js`
3. `AERP-038A_MetadataBuilderEnterpriseWrapper.test.js`
4. `AERP-038B_SingleMetadataBuildConsumerIntegration.test.js`
5. `AERP-038B_SingleMetadataBuildOperationalIntegration.test.js`
6. `AERP-038B_SingleMetadataBuildPipelineIntegration.test.js`

They contain CommonJS/Node APIs unsuitable for Apps Script. Production modules `36_AuthorizationEngine.js` and `37_AuthorizationMetadataRepository.js` also contain executable test entry points. Required closure: version a positive manifest, generate and compare a reproducible sorted listing, verify exclusions, control `filePushOrder` when applicable, hash the exact artifact, and fail on any difference.

### BLOCKER-04 — Exact artifact is not proven (CRITICAL)

The local harness does not prove the exact Apps Script artifact has zero collisions, excludes Node/test files, obeys canonical order, or preserves contracts. Required closure: zero collisions, explicit canonical order, exact-artifact tests, and non-production runtime validation. Permutations are negative detector tests only.

### BLOCKER-05 — Remaining quality gates are not implemented (HIGH)

Phase 1 provides canonical `npm test`/`test:all` execution and sanitized JSON evidence. Phase 2 provides the Globals Gate, but the bundle-manifest check and exact-bundle test remain absent. Current project-wide lint does not yet provide approved zero-warning evidence, and an unqualified `git diff --check` does not inventory untracked files. Required closure: implement and version every remaining gate contract in the Engineering Standard, including `eslint . --max-warnings=0`, a resolved Git range, and separate untracked comparison.

The Globals Gate additionally reports seven productive `eval` uses as blocked dynamic constructions under its fail-closed policy. Their removal or approved product redesign is separate from gate implementation and remains pending.

### BLOCKER-06 — Rollback topology is incomplete (CRITICAL)

Redirecting a versioned deployment does not establish recovery for HEAD execution, bound-script menus, custom functions, or simple/installable triggers. Required closure: identify topology and rehearse four separate recovery paths with post-recovery security tests.

### BLOCKER-07 — Release evidence and remaining joint closure await completion (HIGH)

The historical 299/299 session result remains non-reproducible. Phase 1 has versioned `npm test`, six explicit Node processes, exact suite inventory reconciliation, and sanitized revision-bound JSON evidence for the canonical 233/233 baseline. Phase 2 local evidence is likewise ephemeral. Required closure: implement external, versioned or immutable release retention and complete all remaining gate and product reviews; counts remain supporting evidence rather than a sole release criterion.

### Phase 2 interruption contract

The Globals Gate uses a closed IPC v1 `READY`/`INTERRUPT` protocol. Controlled Windows SIGINT exits with real code 130 and `signal=null`; controlled Windows SIGTERM exits with real code 143 and `signal=null`. Persistence or a sanitized persistence-failure diagnostic completes before the exit code is established, and persistence failure preserves 130/143. Self-tests report 37 passed and one deliberate POSIX-only skip on Windows. Real POSIX signal coverage remains Future / Pending on a POSIX platform.

## 5. Risk register

| Blocker    | Severity | Likelihood | Release effect |
| ---------- | -------- | ---------- | -------------- |
| BLOCKER-01 | CRITICAL | High       | Blocks release |
| BLOCKER-02 | HIGH     | High       | Blocks release |
| BLOCKER-03 | CRITICAL | High       | Blocks release |
| BLOCKER-04 | CRITICAL | High       | Blocks release |
| BLOCKER-05 | HIGH     | High       | Blocks release |
| BLOCKER-06 | CRITICAL | Medium     | Blocks release |
| BLOCKER-07 | HIGH     | High       | Blocks release |

## 6. Requirement traceability

| Requirement                                      | Gate               | Command/control                                            | Evidence                                               | State                                                                                                    | Blocker                 |
| ------------------------------------------------ | ------------------ | ---------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| One authorization contract                       | Contract/security  | Targeted tests plus signed review                          | Contract and report                                    | Pending                                                                                                  | 01                      |
| Globals Gate implementation                      | Globals Gate       | `npm run test:gate:globals`                                | 37 pass / 1 POSIX skip on Windows                      | Implemented / Active; implementation approved                                                            | None for implementation |
| Zero global duplicates and dynamic constructions | Globals Gate       | `npm run qa:globals`                                       | Local schema-1.1.0 evidence; release retention pending | Valid execution; repository blocked at `1 / STRUCTURAL_BLOCKERS`, 3 collisions + 7 dynamic constructions | 01/02/05                |
| Globals release evidence                         | Evidence retention | Clean-checkout CI or approved external retention           | Versioned or immutable revision-bound record           | Future / Pending                                                                                         | 05/07                   |
| Resolve Globals product findings                 | Product change     | Separate approved work item and contract/security tests    | Zero collisions and zero blocked dynamic constructions | Pending; outside the gate/documentation change                                                           | 01/02/05                |
| Positive publication set                         | Bundle manifest    | `npm run bundle:manifest:check`                            | Manifest/list/order/hashes                             | Pending                                                                                                  | 03                      |
| Exact bundle behavior                            | Artifact test      | `npm run test:bundle`                                      | Hash-bound report                                      | Pending                                                                                                  | 04                      |
| Reproducible full suite                          | Full suite         | `npm test`                                                 | Named JSON test report                                 | Implemented / Active; 233/233 across six suites                                                          | 05/07                   |
| Zero lint warnings                               | Lint               | `eslint . --max-warnings=0`                                | Tool log                                               | Pending                                                                                                  | 05                      |
| Range whitespace                                 | Diff               | `git diff --check <approved-base>...HEAD`                  | Resolved range/log                                     | Pending                                                                                                  | 05                      |
| Untracked control                                | Inventory          | `git ls-files --others --exclude-standard` plus comparison | Sorted approved list                                   | Pending                                                                                                  | 05                      |
| Four recovery paths                              | Rollback           | Controlled topology exercises                              | Recovery records                                       | Pending                                                                                                  | 06                      |

## 7. Closure rule

Documents alone do not close these blockers. Each requires a reviewable implementation, versioned executable control, immutable evidence, exact artifact identity, and approval. BLOCKER-01 additionally requires security approval. Until all rows are closed, AERP-QA-001 and AERP-039 remain NO-GO.

## 8. Official references

Consulted **2026-08-24**:

- [Apps Script V8 global scope and module limitations](https://developers.google.com/apps-script/guides/v8-runtime)
- [Apps Script deployments](https://developers.google.com/apps-script/concepts/deployments)
- [Apps Script bound scripts](https://developers.google.com/apps-script/guides/bound)
- [Apps Script installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- [clasp configuration files](https://github.com/google/clasp/blob/master/docs/config-files.md)
- [clasp project settings and `filePushOrder`](https://github.com/google/clasp)
- [Git diff documentation](https://git-scm.com/docs/git-diff)
- [ESLint CLI](https://eslint.org/docs/latest/use/command-line-interface)
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Secure Deployment guidance](https://devguide.owasp.org/en/05-implementation/)
