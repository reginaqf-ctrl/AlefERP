# AERP-QA-001 — Test Strategy

## 1. Objective and baseline

This strategy protects AERP while structural blockers are removed and validates the exact Apps Script artifact.

The **299/299** result was executed locally in-session on **2026-08-24** against `ef8b0ecc764a8429d2c3e46c2b47b91a30994090`. It is an informative baseline only: no canonical versioned repository command or reproducible report exists yet. Acceptance depends on test identity, risk coverage, inventory, and artifact hash—not raw count.

All commands below are future expected controls. AERP-QA-001 cannot close until they are implemented and versioned.

## 2. Test layers

### Static structure

`npm run audit:globals` MUST parse the positive bundle for top-level functions, classes, `const`/`let`/`var`, and assignments to `globalThis`. It MUST fail on every unresolved duplicate, including apparently equivalent implementations.

Required regression cases:

- incompatible `aerpAuthorize` contracts;
- duplicate `AERP_AUTHORIZATION_VERSION` ownership;
- duplicate `aerpMetadataToRow` ownership;
- a hidden duplicate introduced through `globalThis`;
- a parser or unclassified-file failure.

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

| Gate      | Future command/control                                               | Input                    | Output                          | Responsible        | Failure condition             | Evidence               |
| --------- | -------------------------------------------------------------------- | ------------------------ | ------------------------------- | ------------------ | ----------------------------- | ---------------------- |
| Targeted  | `npm run test:target -- <work-item>`                                 | Risk/contract inventory  | Named test report               | Developer          | Failure or missing case       | Revision-linked report |
| Full      | `npm run test:all`                                                   | Canonical inventory      | Pass/fail/skip plus identities  | QA                 | Failure or inventory mismatch | Immutable report       |
| Globals   | `npm run audit:globals`                                              | Positive bundle          | Complete symbol map             | Architecture owner | Any collision or parse gap    | Symbol report          |
| Bundle    | `npm run bundle:manifest:check`                                      | Manifest/config/order    | Exact sorted listing and hashes | Release owner      | Difference or unsafe file     | Signed listing         |
| Artifact  | `npm run test:bundle`                                                | Candidate artifact hash  | Contract/integration results    | QA                 | Failure or hash mismatch      | Artifact report        |
| Lint      | `eslint . --max-warnings=0`                                          | Versioned JS files       | Zero findings                   | Developer          | Warning/error/nonzero         | Tool log               |
| Format    | `prettier --check <reviewed-files>`                                  | Approved inventory       | Formatted result                | Developer          | Omission or nonzero           | Tool log               |
| Diff      | `git diff --check <approved-base>...HEAD`                            | Resolved Git range       | No whitespace errors            | Developer          | Nonzero/wrong range           | Range and output       |
| Untracked | `git ls-files --others --exclude-standard` plus allowlist comparison | Worktree                 | Empty/exact approved list       | Reviewer           | Unknown file                  | Sorted inventory       |
| Runtime   | Approved smoke procedure                                             | Exact non-prod candidate | Expected outcomes               | Validator          | Any mismatch                  | Runtime record         |
| Recovery  | Four topology exercises                                              | Known-good targets       | Restored service and security   | Release owner      | Any unrecovered path          | Exercise report        |

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
