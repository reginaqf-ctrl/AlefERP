# AERP-QA-001 — Engineering Standard

## 1. Purpose and status

This standard defines the minimum engineering controls for changing, validating, and releasing AERP. It may define future gates, but AERP-QA-001 cannot close until every mandatory control is implemented, executable, versioned, and supported by reproducible evidence.

Current disposition: **NO-GO**. AERP-039 may not proceed.

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## 2. Core principles

1. A change MUST preserve backward compatibility unless an approved migration replaces it.
2. Each module and public symbol MUST have one canonical owner and implementation.
3. Public APIs MUST have explicit, versioned contracts.
4. Security-sensitive behavior MUST fail closed; explicit deny MUST prevail.
5. Production changes MUST include positive, negative, boundary, and regression tests.
6. Evidence MUST be reproducible from a clean checkout of an immutable revision.
7. Every change MUST be reviewable, reversible, and traceable to an approved work item.

These principles align with NIST SSDF practices for protected software, well-secured releases, and retained verification evidence, and with OWASP authorization guidance to deny safely when checks fail.

## 3. Apps Script namespace and ownership

Apps Script V8 executes project script files in a global scope and does not support ES modules. File names and numeric prefixes do not provide isolation.

- The exact deployable bundle MUST contain zero unresolved global collisions.
- Every global function, class, constant, variable, and `globalThis` assignment MUST have one owner.
- Compatibility MUST use an explicitly named adapter and MUST NOT redeclare a public symbol.
- An explicit canonical file order MUST be recorded only where legitimate dependencies require it.
- `filePushOrder` MUST be controlled and verified when order is material.
- The exact artifact produced from the positive bundle manifest MUST be tested.
- Order permutations MAY be used only as negative tests proving that collision detection fails the build; they are not evidence that duplicate globals are safe.

The current inventory contains:

| Symbol                       | Locations                                                      | Classification                                                         | Status   |
| ---------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| `aerpAuthorize`              | `36_AuthorizationEngine.js`; `AERP-036_AuthorizationEngine.js` | Incompatible contracts: `(request, options)` versus `(context, model)` | Blocking |
| `AERP_AUTHORIZATION_VERSION` | `36_AuthorizationEngine.js`; `AERP-036_AuthorizationEngine.js` | Apparently equivalent value (`1.0.0`), but duplicate global ownership  | Blocking |
| `aerpMetadataToRow`          | `04_ActionEngine.js`; `07_Writer.js`                           | Apparently equivalent signature and implementation                     | Blocking |

Apparent equivalence does not waive the single-owner rule.

## 4. Positive bundle and clasp controls

The release process MUST use a positive, versioned bundle manifest that lists every allowed Apps Script source and manifest file. Extension-based discovery alone is prohibited.

Until a positive exclusion is implemented and verified, the potential clasp publication surface includes `eslint.config.js` and these six test files:

1. `AERP-036_AuthorizationEngine.test.js`
2. `AERP-038A_MetadataBuilderEnterprise.test.js`
3. `AERP-038A_MetadataBuilderEnterpriseWrapper.test.js`
4. `AERP-038B_SingleMetadataBuildConsumerIntegration.test.js`
5. `AERP-038B_SingleMetadataBuildOperationalIntegration.test.js`
6. `AERP-038B_SingleMetadataBuildPipelineIntegration.test.js`

These files use Node/CommonJS APIs and MUST NOT enter an Apps Script bundle. Before any authorized synchronization, the process MUST generate a reproducible, sorted file listing and compare it exactly with the positive manifest. Unexpected, missing, test-only, Node-only, or configuration files MUST fail the gate.

## 5. Public API and security contracts

Each public API MUST document inputs, defaults, result schema, invariants, validation, authorization boundaries, tenant boundaries, side effects, sanitized failure behavior, version, and compatibility policy.

- Authorization MUST use a verified trusted principal.
- Caller-supplied identity MUST NOT be trusted without verification.
- Invalid inputs, invalid policies, missing rules, and evaluation errors MUST deny.
- Tenant boundaries MUST be enforced in every authorization data lookup.
- Test injection MUST be unreachable unless an explicit test-mode guard is active.
- Security decisions MUST be auditable without logging secrets or personal data.

## 6. Mandatory gate contract

The following commands are **future expected interfaces**, not current capabilities. Their implementations and scripts MUST be added and versioned by an authorized remediation before AERP-QA-001 can close.

| Gate                | Future command/control                                                   | Input                                                                | Required output                          | Responsible        | Failure condition                               | Evidence                        |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------- | ------------------ | ----------------------------------------------- | ------------------------------- |
| Targeted tests      | `npm run test:target -- <work-item>`                                     | Changed contracts and files                                          | Named tests with pass/fail/skip totals   | Developer          | Any failure, missing risk case, or unknown test | Machine report tied to revision |
| Full suite          | `npm run test:all`                                                       | Canonical test inventory                                             | Complete suite report                    | QA                 | Failure, omission, or inventory mismatch        | Versioned/immutable report      |
| Lint                | `eslint . --max-warnings=0`                                              | Versioned JS inventory                                               | Zero errors and zero warnings            | Developer          | Nonzero exit or any warning                     | Command log and versions        |
| Format              | `prettier --check <reviewed-files>`                                      | Reviewed file inventory                                              | All files formatted                      | Developer          | Nonzero exit or omitted reviewed file           | Command log                     |
| Whitespace range    | `git diff --check <approved-base>...HEAD`                                | Approved base and candidate revision                                 | No whitespace errors                     | Developer          | Nonzero exit or wrong base                      | Command and resolved revisions  |
| Untracked inventory | `git ls-files --others --exclude-standard` plus approved-file comparison | Clean checkout/worktree                                              | Empty list or exact approved list        | Reviewer           | Unexpected or unreviewed file                   | Sorted listing and approval     |
| Global collisions   | `npm run audit:globals`                                                  | Positive bundle manifest and parsed global declarations/assignments  | Zero unresolved collisions               | Architecture owner | Duplicate, parse gap, or manifest mismatch      | Symbol inventory report         |
| Bundle manifest     | `npm run bundle:manifest:check`                                          | Positive manifest, clasp config, ignore rules, `filePushOrder`       | Exact reproducible sorted file set       | Release owner      | Unexpected/missing file or uncontrolled order   | Manifest, hashes, listing       |
| Exact artifact      | `npm run test:bundle`                                                    | Exact candidate artifact                                             | Contract, load, and smoke tests pass     | QA                 | Any failure or artifact hash mismatch           | Artifact hash and report        |
| Security review     | Approved checklist and threat/contract review                            | Authorization and tenant changes                                     | Signed review                            | Security reviewer  | Open critical/high issue                        | Review record                   |
| Runtime smoke       | Approved non-production Apps Script procedure                            | Exact candidate version                                              | Critical allow/deny and workflow results | Validator          | Any mismatch or unsanitized output              | Runtime report                  |
| Rollback rehearsal  | Topology-specific runbook exercise                                       | Known-good version, HEAD recovery, menus, custom functions, triggers | Recovery objectives satisfied            | Release owner      | Unrecoverable path or failed smoke test         | Exercise record                 |

Counts alone are not acceptance evidence. The 299-test result is an informative baseline and MUST be reconciled by test identity and risk coverage.

## 7. Review, change, and exceptions

- Production code MUST NOT change without tests.
- Generated, legacy, test, and hand-maintained files MUST be distinguishable.
- Commits MUST be semantic and cohesive.
- Staging, committing, pushing, merging, rebasing, clasp operations, and deployment require explicit approval.
- Exceptions require owner, rationale, risk, compensating control, expiry, and approver; they MUST NOT bypass security or release gates silently.

## 8. Official references

Consulted **2026-08-24**:

- [Google Apps Script V8 runtime: global scope, execution order, and module limitations](https://developers.google.com/apps-script/guides/v8-runtime)
- [Google Apps Script deployments](https://developers.google.com/apps-script/concepts/deployments)
- [Google Apps Script versions](https://developers.google.com/apps-script/guides/versions)
- [clasp configuration files and `.claspignore`](https://github.com/google/clasp/blob/master/docs/config-files.md)
- [clasp project settings, extensions, `filePushOrder`, and file status](https://github.com/google/clasp)
- [Git `diff --check`](https://git-scm.com/docs/git-diff)
- [ESLint CLI and `--max-warnings`](https://eslint.org/docs/latest/use/command-line-interface)
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [NIST SP 800-53 Rev. 5, configuration and contingency controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Developer Guide: Secure Deployment](https://devguide.owasp.org/en/05-implementation/)
