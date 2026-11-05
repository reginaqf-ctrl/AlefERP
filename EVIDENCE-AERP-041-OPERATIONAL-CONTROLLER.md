# AERP-041 — Operational Controller Evidence

## Scope

This increment connects the approved secure AERP-041 components to an explicit operational workflow for a bound, isolated spreadsheet. It does not deploy Apps Script, write to an external Google Sheet, publish a branch or merge code.

- Branch: `feature/AERP-041-operational-controller`
- Exact parent: `e64e7091ed2fa065cfc4b053e1084f93e13b497b`
- Product scope: Alef ERP 1.0 only
- AppSheet tier: Core, with durable manual attestation

## Implemented contracts

### Secure confirmation renewal

`aerpCreateAppsScriptSecureBootstrap()` now exposes `renewConfirmation({ intent: 'APPLY' })` for an existing `INCOMPLETE` installation.

Renewal succeeds only when all of these remain exact:

- active bound spreadsheet;
- source, target and tenant binding;
- OIDC issuer and subject;
- one-time bootstrap claim in `CLAIMED` state;
- AERP-040 plan digest;
- installation configuration digest;
- explicit `APPLY` intent.

The new confirmation is short lived, the claim is rebound atomically under the document lock and superseded evidence can no longer satisfy the claim. The controller never persists the raw nonce.

### Preapproved initial administrator

The closed operational configuration now requires `expectedAdminEmail`. The secure bootstrap compares it case-insensitively with the e-mail claim from the Google OIDC token and requires `email_verified: true` before issuing or renewing confirmation evidence. The first caller is therefore not implicitly trusted. After the initial claim, the existing issuer and subject binding remains immutable.

The approved e-mail is deployment configuration in Script Properties; it is not hardcoded in product code or copied into authorization metadata by absence. Invalid, missing or mismatched configuration fails before any sheet or document-property mutation.

### Per-table AppSheet evidence and integrity

The manual AppSheet input now requires exactly 17 table evidence rows, one for every physical table in the AERP-040 blueprint. Every row independently confirms the security filter, update policy, administrator allow test, restricted-user deny test and cross-tenant deny test and contains its own evidence reference and SHA-256 digest. Missing, duplicate, renamed or false entries fail closed.

The persisted attestation carries a deterministic digest covering all stored fields, including AppSheet identifiers, versions, timestamp, reviewer, global checks and the 17 table rows. Any uncoordinated field change invalidates readiness and keeps installation `INCOMPLETE`. This is tamper-evident within the Apps Script trust boundary, not an external digital signature against a malicious script editor able to replace code and properties together.

### Operational controller

`AERP-041_OperationalController.js` provides:

- `preview()` — validates configuration and returns only state and operation count;
- `start()` — requires explicit confirmation, issues or renews evidence and applies immediately;
- `complete()` — validates the exact global checklist and 17 table evidence rows, requires explicit confirmation, records attestation, renews evidence and immediately verifies completion;
- `status()` — returns sanitized readiness and verification facts.

The Apps Script adapter reads only two closed-schema Script Properties:

- `AERP041_OPERATIONAL_CONFIG`;
- `AERP041_APPSHEET_ATTESTATION_INPUT`.

Durable security state remains document-scoped in `DocumentProperties`. `targetId` is derived from the active spreadsheet and cannot be supplied by configuration.

### Read-only bootstrap preflight and cell safety

Planning now has a non-mutating preflight path for an `EMPTY` or installer-owned `INCOMPLETE` target. It still requires the verified, preapproved OIDC principal and an eligible isolated spreadsheet. For an incomplete installation it additionally requires the existing claimed bootstrap and its confirmation to remain bound to the same issuer, subject, source, target and tenant. The preflight cannot create a claim, persist state or expose a write adapter.

All values provisioned into the initial administrative rows are validated immediately before `setValues()`. Text beginning with spreadsheet formula markers, control characters, non-finite numbers and unsupported value types are rejected. OIDC identity and company text are also rejected earlier by the secure bootstrap, before confirmation evidence is written.

### Staged administrative authorization

Bootstrap authorization is now explicitly staged. While the durable installation state is `INCOMPLETE`, only the approved administrator's `ADMINISTRACION/ADMINISTER` permission is `ALLOW`; the other seven commercial modules have explicit `DENY` permissions and hidden menu assignments. After all structural, authorization and AppSheet Core checks pass, the adapter persists `COMPLETE`, promotes those exact installer-owned permission rows and only then consumes the one-time bootstrap.

The promotion accepts only the deterministic installer-owned incomplete or complete row sets. Unexpected, duplicate or modified authorization rows fail closed. A failed completion attempt restores the restricted incomplete permission set before recording `INCOMPLETE` whenever durable storage remains available.

### Production wiring regression coverage

The Apps Script public adapter is exercised directly with missing properties, malformed JSON, extra keys and prototype-pollution keys. Tests also verify that the active bound spreadsheet supplies `targetId`, each of the three public menu handlers invokes only its assigned operational method and `onOpen()` registers the exact three AERP-041 commands.

### Menu and runbook

The Alef ERP menu adds:

- **Instalación segura**;
- **Completar AppSheet Core**;
- **Estado instalación segura**.

The legacy **Generar ERP** command remains separate and is not an authorization path.

Operational inputs, AppSheet Core checks, expected states and failure handling are documented in `AERP-041_APPSHEET_CORE_OPERATIONAL_RUNBOOK.md`.

## Security review

- Default DENY is unchanged.
- AERP-036/AERP-037 remain authoritative.
- Absence of metadata never grants access.
- Visibility and navigation never grant authorization.
- Initial bootstrap remains one-time and limited to an empty isolated copy.
- Read-only planning cannot claim bootstrap authority or mutate the target.
- Initial bootstrap evidence can be issued only to the preapproved, verified administrator e-mail.
- Only `ADMINISTRACION/ADMINISTER` is allowed before durable `COMPLETE`; all other commercial module permissions remain explicit `DENY`.
- Full administrator permissions are promoted only after verification and a durable `COMPLETE` state.
- The governed installation requires the approved administrator to remain the only spreadsheet and script editor until `COMPLETE`.
- Formula-capable OIDC and company text is rejected before any sheet write.
- Renewal cannot change principal, tenant, target, plan or company configuration.
- A different OIDC subject is rejected.
- AppSheet attestation requires explicit metadata administration.
- AppSheet attestation requires one exact evidence row for every AERP-040 table.
- Altered attestation fields fail the stored integrity digest.
- Responses omit OIDC tokens, e-mail, nonce, journal contents and attestation digest.
- Persistence ambiguity returns `UNKNOWN`; it never claims success.
- The 17-table AERP-040 model and presentation manifest are unchanged.

## Tests

Canonical runtime: Node `24.18.0`.

| Check                             | Result                                                                   |
| --------------------------------- | ------------------------------------------------------------------------ |
| Product suites                    | **358/358 PASS** across 10 declared suites                               |
| Operational controller tests      | **14/14 PASS**                                                           |
| Apps Script runtime/renewal tests | **35/35 PASS**                                                           |
| ESLint                            | PASS, zero warnings                                                      |
| Targeted Prettier                 | PASS                                                                     |
| Globals Gate                      | PASS: 46 included files, 829 symbols, 0 collisions, 0 dynamic violations |
| Globals Gate autotests            | **36 PASS**, 2 platform skips                                            |
| Bundle manifest check             | PASS: 45 scripts, 46 artifact files                                      |
| Bundle Gate autotests             | **18/18 PASS**                                                           |
| `git diff --check`                | PASS                                                                     |

The test-gate autotest suite reports **41/42 PASS** in this restricted Windows host. Its sole failure is the pre-existing real `taskkill` process-tree test, because the host cannot confirm termination of a controlled descendant. All atomic evidence tests pass when their temporary directory is placed inside the authorized workspace. No product assertion or AERP-041 test failed, and the canonical ten-suite gate completed with exit code 0 and 358/358 tests.

## Files changed by this increment

Product:

- `AERP-041_AppsScriptRuntimeAdapter.js`
- `AERP-041_SecureBootstrap.js`
- `AERP-041_AppSheetCoreReadinessValidator.js`
- `AERP-041_OperationalController.js`
- `18_Menu.js`

Tests and delivery controls:

- `AERP-041_AppsScriptRuntimeAdapter.test.js`
- `AERP-041_OperationalController.test.js`
- `.claspignore`
- `qa/manifests/apps-script-bundle.json`
- `qa/manifests/apps-script-globals.json`
- `qa/manifests/test-suites.json`
- `scripts/qa/test-inventory.mjs`
- `scripts/qa/specs/bundle-gate.spec.mjs`
- `scripts/qa/specs/globals-gate.spec.mjs`
- `scripts/qa/specs/test-gate.spec.mjs`

Documentation:

- `AERP-041_APPSHEET_CORE_OPERATIONAL_RUNBOOK.md`
- `EVIDENCE-AERP-041-OPERATIONAL-CONTROLLER.md`

## Remaining external actions

No external action was performed. Before a real installation:

1. review this local diff independently;
2. commit and publish only with explicit authorization;
3. deploy Apps Script only with separate authorization;
4. configure the two Script Properties in the isolated bound project;
5. run the workflow against the approved isolated copy;
6. complete and retain the AppSheet Core acceptance evidence.
