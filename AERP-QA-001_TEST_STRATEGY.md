# AERP-QA-001 — Test Strategy

## 1. Objective and baseline

This strategy protects AERP while structural blockers are removed and validates the exact Apps Script artifact.

Current disposition: **NO-GO**. AERP-QA-001 remains incomplete, and AERP-039 may not proceed.

The **299/299** result was executed locally during a prior session on **2026-08-24** against `ef8b0ecc764a8429d2c3e46c2b47b91a30994090`. It is retained exclusively as historical, non-reproducible evidence. The canonical Phase 1 baseline is **233/233**, reproducible with `npm test` and reconciled as follows:

| Suite path                                                    | Expected tests |
| ------------------------------------------------------------- | -------------- |
| `AERP-036_AuthorizationEngine.test.js`                        | 14             |
| `AERP-038A_MetadataBuilderEnterprise.test.js`                 | 40             |
| `AERP-038A_MetadataBuilderEnterpriseWrapper.test.js`          | 66             |
| `AERP-038B_SingleMetadataBuildConsumerIntegration.test.js`    | 51             |
| `AERP-038B_SingleMetadataBuildPipelineIntegration.test.js`    | 34             |
| `AERP-038B_SingleMetadataBuildOperationalIntegration.test.js` | 28             |
| **Total: `14 + 40 + 66 + 51 + 34 + 28`**                      | **233**        |

The historical difference is 66: `299 = 233 + 66`. This is compatible with a probable double count of the 66-test AERP-038A wrapper suite, but it is not proven by primary evidence. The local evidence is written to the Git-ignored `.qa-output/test-evidence.json`; it MUST be regenerated for every review or release candidate and MUST NOT be reused between runs. The baseline does not guarantee absence of defects and is not sufficient alone for release acceptance.

`npm test` is the implemented canonical Phase 1 command, and `npm run test:all` is its active alias. Phase 2 also implements the Globals Gate through `npm run qa:globals`, with `npm run test:gate:globals` as its self-test command. Other controls identified below remain future expected controls. Approved gate implementations do not close AERP-QA-001 while the repository fails an active gate or other mandatory gates remain pending. Staging remains unauthorized.

## 2. Test layers

### Static structure

The implemented `npm run qa:globals` command uses the public ESLint `Linter` API to parse the closed inventory for top-level functions, classes, `const`/`let`/`var`, assignments to `globalThis`, and prohibited dynamic constructions. It fails on every unresolved duplicate, including apparently equivalent implementations, and on productive dynamic-code use under the fail-closed policy. `npm run test:gate:globals` exercises the implementation.

Required regression cases:

- incompatible `aerpAuthorize` contracts;
- duplicate `AERP_AUTHORIZATION_VERSION` ownership;
- duplicate `aerpMetadataToRow` ownership;
- a hidden duplicate introduced through `globalThis`;
- a parser or unclassified-file failure.

The approved inventory is closed at 38 included, 7 excluded, and 45 discovered files. The current valid execution reports 758 unique symbols, 781 occurrences, three duplicate symbols, and seven blocking productive `eval` uses. Its expected result is exit `1 / STRUCTURAL_BLOCKERS`; this is a valid gate execution against a blocked repository, not a repository pass.

The three duplicate symbols are `aerpAuthorize` (`incompatible-public-entrypoint`, CRITICAL), `AERP_AUTHORIZATION_VERSION` (`equivalent-duplicate`, HIGH), and `aerpMetadataToRow` (`equivalent-duplicate`, HIGH). Resolving them and the seven `eval` findings is separate product work.

The closed IPC v1 `READY`/`INTERRUPT` tests produce real Windows exits 130/SIGINT and 143/SIGTERM with `signal=null`. Persistence, or a sanitized persistence-failure diagnostic, finishes before the exit code is set; persistence failure preserves 130/143. The self-test result is 37 passed and one deliberate POSIX-only skip on Windows. Real POSIX signal delivery remains Future / Pending on a POSIX platform.

The bundle MUST have zero collisions. A canonical order and `filePushOrder` MUST be explicit when dependencies require them. The exact ordered artifact MUST be tested. Order permutations are permitted only as negative tests that must trigger collision or dependency detection.

### Bundle publication safety

`npm run bundle:manifest:check` MUST compare a versioned positive manifest with a reproducible sorted listing derived from clasp configuration, ignore rules, extensions, and `filePushOrder`.

Until verified exclusion exists, the potential publication surface includes:

- `eslint.config.js`;
- `AERP-036_AuthorizationEngine.test.js`;
- `AERP-038A_MetadataBuilderEnterprise.test.js`;
- `AERP-038A_MetadataBuilderEnterpriseWrapper.test.js`;
- `AERP-038B_SingleMetadataBuildConsumerIntegration.test.js`;
- `AERP-038B_SingleMetadataBuildOperationalIntegration.test.js`;
- `AERP-038B_SingleMetadataBuildPipelineIntegration.test.js`.

The gate MUST fail if any Node/CommonJS/test-only file is publishable, or if any listed manifest entry is absent, unexpected, reordered without approval, or has an unexpected hash.

### Unit and contract tests

`npm run test:target -- <work-item>` MUST cover deterministic units and the public contracts for canonical authorization, immutable default deny, deny precedence, strict condition validation, trusted principal, tenant isolation, sanitized errors, metadata schemas, and lineage.

Required authorization outcomes:

| Scenario                                                       | Expected result            |
| -------------------------------------------------------------- | -------------------------- |
| Verified principal and matching allow, without applicable deny | Allow                      |
| Global or specific deny                                        | Deny                       |
| No matching rule                                               | Deny                       |
| Invalid request, model, condition, or operator                 | Deny with sanitized result |
| Evaluation exception                                           | Deny                       |
| Cross-tenant role, module, or permission                       | Deny                       |
| Unverified caller identity                                     | Deny                       |
| Test injection outside guarded mode                            | Deny                       |
| Duplicate or missing canonical API                             | Build failure              |

### Integration and exact-artifact tests

`npm run test:all` MUST execute the canonical test inventory. `npm run test:bundle` MUST run against the exact artifact hash and cover metadata resolution, consumer/generator boundaries, lineage agreement, pre-write gates, initialization, and representative authorization paths.

### Non-production runtime smoke tests

An approved validator MUST test the exact candidate in a dedicated non-production Apps Script project: bootstrap, metadata read, representative allow, default deny, explicit deny, cross-tenant deny, invalid-policy deny, dry run, menus, custom functions, and configured triggers. Fixtures MUST be deterministic, synthetic, tenant-isolated, and free of secrets or personal data.

### Rollback tests

Exercises MUST separately prove recovery for versioned deployments, HEAD execution, menus/custom functions, and simple/installable triggers. Each exercise repeats the relevant security and workflow smoke tests.

## 3. Gate specifications

In this strategy, an **implemented gate** is active and reproduced; **local execution evidence** is ephemeral and regenerated for one run; **release evidence** is externally retained, versioned or immutable evidence that remains pending; and a **future gate** is not yet implemented.

| Gate                        | Status               | Command/control                                                            | Input                                                    | Output                                                                                                                                              | Responsible             | Failure condition                                                                                                                                          | Evidence                                                                                                                                                                                              |
| --------------------------- | -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Targeted/security           | Future / Pending     | `npm run test:target -- <work-item>` plus contract/security review         | Risk and contract inventory                              | Named test report and signed review                                                                                                                 | Developer/reviewer      | Failure, missing case, or open critical/high issue                                                                                                         | Future release evidence: revision-linked report and review record                                                                                                                                     |
| Full Suite Gate             | Implemented / Active | Canonical: `npm test`; active alias: `npm run test:all`                    | Exact identities of six declared/discovered suites       | Six explicit Node processes; six executed suites; pass/fail/skip/todo/cancelled totals; current baseline 233/233                                    | QA                      | Failure, cancellation, omission, inventory mismatch, wrong Node version, incomplete suite, or invalid evidence                                             | Current local execution evidence: Git-ignored `.qa-output/test-evidence.json`; ephemeral, revision-bound and `runId`-bound; regenerated on every run; not reusable for another review                 |
| Clean-checkout CI           | Future / Pending     | Reproducible CI workflow                                                   | Clean checkout and fixed Node version                    | All implemented gates reproduced without credentials or Apps Script access                                                                          | QA/CI owner             | Checkout, dependency, gate, or reproducibility failure                                                                                                     | Future release evidence: externally retained CI result                                                                                                                                                |
| Globals Gate                | Implemented / Active | Operational: `npm run qa:globals`; self-tests: `npm run test:gate:globals` | Closed inventory: 38 included, 7 excluded, 45 discovered | Valid execution: 758 unique symbols, 781 occurrences, 3 duplicate symbols, 7 blocking dynamic constructions; current exit `1 / STRUCTURAL_BLOCKERS` | Architecture owner      | Implementation/integrity error, inventory mismatch, parse gap, unresolved collision, or blocked dynamic construction; current repository result is blocked | Current local execution evidence: Git-ignored `.qa-output/globals-evidence.json`, schema `1.1.0`; ephemeral, revision-bound and `runId`-bound; regenerated every run; not reusable for another review |
| Globals release evidence    | Future / Pending     | Clean-checkout CI or approved external retention                           | Exact revision and Globals Gate input                    | Versioned or immutable retained record                                                                                                              | Release owner           | Missing, mutable, reused, or revision-mismatched record                                                                                                    | Future release evidence; local `.qa-output/` evidence does not satisfy this row                                                                                                                       |
| Globals product remediation | Future / Pending     | Separate approved product work and contract/security tests                 | Three duplicate symbols and seven dynamic constructions  | Zero unresolved findings without weakening fail-closed policy                                                                                       | Product/security owners | Any remaining collision, dynamic construction, or contract regression                                                                                      | Future release evidence linked to the product change                                                                                                                                                  |
| Bundle/clasp/order          | Future / Pending     | `npm run bundle:manifest:check`                                            | Manifest, clasp configuration, exclusions, order         | Exact sorted listing and hashes                                                                                                                     | Release owner           | Difference, unsafe file, or uncontrolled order                                                                                                             | Future release evidence: signed listing                                                                                                                                                               |
| Exact artifact/runtime      | Future / Pending     | `npm run test:bundle`                                                      | Candidate artifact hash                                  | Contract, integration, combined-runtime, and safe smoke results                                                                                     | QA                      | Failure, missing dependency, collision, or hash mismatch                                                                                                   | Future release evidence: artifact report                                                                                                                                                              |
| Lint                        | Future / Pending     | `eslint . --max-warnings=0`                                                | Versioned JS files                                       | Zero findings                                                                                                                                       | Developer               | Warning, error, or nonzero exit                                                                                                                            | Future release evidence: tool log                                                                                                                                                                     |
| Format                      | Future / Pending     | `prettier --check <reviewed-files>`                                        | Approved inventory                                       | Formatted result                                                                                                                                    | Developer               | Omission or nonzero exit                                                                                                                                   | Future release evidence: tool log                                                                                                                                                                     |
| Diff                        | Future / Pending     | `git diff --check <approved-base>...HEAD`                                  | Resolved Git range                                       | No whitespace errors                                                                                                                                | Developer               | Nonzero exit or wrong range                                                                                                                                | Future release evidence: range and output                                                                                                                                                             |
| Untracked                   | Future / Pending     | `git ls-files --others --exclude-standard` plus allowlist comparison       | Worktree                                                 | Empty or exact approved list                                                                                                                        | Reviewer                | Unknown file                                                                                                                                               | Future release evidence: sorted inventory                                                                                                                                                             |
| Runtime smoke               | Future / Pending     | Approved non-production smoke procedure                                    | Exact non-production candidate                           | Expected security and workflow outcomes                                                                                                             | Validator               | Any mismatch or unsanitized output                                                                                                                         | Future release evidence: runtime record                                                                                                                                                               |
| Rollback                    | Future / Pending     | Four topology exercises                                                    | Known-good targets                                       | Restored service and security                                                                                                                       | Release owner           | Any unrecovered path                                                                                                                                       | Future release evidence: exercise report                                                                                                                                                              |

The Full Suite Gate's `.qa-output/test-evidence.json` and Globals Gate's `.qa-output/globals-evidence.json` are local execution evidence only. They are ephemeral, revision-bound and `runId`-bound, regenerated by each run, ignored by Git, and not reusable for another review. They are not release evidence. External, versioned or immutable retention from a clean checkout or CI remains Future / Pending and MUST be implemented in a later phase.

## 4. Entry, exit, and evidence

Entry requires approved contracts, risk inventory, positive bundle manifest, canonical file order, test inventory, and recovery topology. Exit requires every applicable gate to be implemented, versioned, passing, and independently reviewable with revision, UTC time, executor, environment, tool versions, exact command/control, input inventory, artifact hash, outcomes, deviations, and approval.

## 5. References

Consulted **2026-08-24**:

- [Apps Script V8 runtime](https://developers.google.com/apps-script/guides/v8-runtime)
- [clasp configuration files](https://github.com/google/clasp/blob/master/docs/config-files.md)
- [Git `diff --check`](https://git-scm.com/docs/git-diff)
- [ESLint CLI](https://eslint.org/docs/latest/use/command-line-interface)
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
