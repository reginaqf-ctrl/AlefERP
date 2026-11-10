# AERP-041 — Commercial RC Integration Evidence

## Scope and exact references

- Repository: `reginaqf-ctrl/AlefERP`.
- Integration branch: `integration/AERP-041-commercial-rc`.
- Release base: `58a701d748e0980196c4f95f0428719c2044fc78`.
- Integrated feature: `b06163c98d89f8afe94747bf3112905a955a29d1`.
- Merge commit: `98f14c40d75278b6488f3752b4ccd866a102b865`.
- Security-fix base: `c8c6590f78354be2df88d4c82f42821219e078db`.
- Reviewed candidate: `02bcaf153331660b63fed086eaf66fca1bb054bd`.
- Product scope: Alef ERP 1.0 only.

The integration branch was published only as a backup and review candidate. No pull
request, merge into release, `clasp push`, deployment, OAuth modification, Google
Sheets write or AppSheet modification was performed.

## Integrated checkpoints

| Commit    | Purpose                                                                   |
| --------- | ------------------------------------------------------------------------- |
| `98f14c4` | Merge the approved AERP-041 operational controller into the release base. |
| `c00da0c` | Normalize inherited formatting without changing program semantics.        |
| `e6eceaa` | Remediate the high-severity release-tooling dependency findings.          |
| `39194af` | Make Globals Gate process-readiness tests deterministic.                  |
| `c8c6590` | Make administrative access promotion fail-closed and recoverable.         |
| `02bcaf1` | Close bootstrap authorization windows before commercial permission grant. |

## Recoverable access-promotion contract

The runtime no longer accepts the durable `COMPLETE` flag as sufficient evidence of
commercial readiness. A bootstrap installation is complete only when all of the
following remain mutually consistent:

1. the AppSheet Core attestation validates against the frozen AERP-040 plan;
2. `CORE_ROL_MODULO` contains exactly the eight deterministic installer-owned rows,
   for the configured tenant, with every menu visible;
3. `CORE_PERMISOS` contains exactly the eight deterministic installer-owned rows,
   for the configured tenant, with `ALLOW` and all approved capabilities enabled;
4. the bootstrap claim and its confirmation are durably `CONSUMED`;
5. the installer state is `COMPLETE` and a fresh verification succeeds.

During promotion, each existing access row must equal either the approved restricted
row or its approved final row at the same deterministic position. Missing, duplicate,
reordered, foreign-tenant or altered rows fail closed and are not silently repaired.
The installer persists the bound `COMPLETE` state and consumes the one-time bootstrap
before any commercial permission can become `ALLOW`. It then promotes navigation and
finally promotes `CORE_PERMISOS` last. A failure while persisting state or consuming
the bootstrap therefore cannot expose commercial authorization.

A recognized partial promotion can be retried under the same document lock and
principal binding. The retry is idempotent, does not duplicate rows and does not infer
authorization from absent metadata. Consumed-bootstrap recovery is accepted only for
the same OIDC issuer and subject, tenant, target, plan and configuration. A legacy
state that was written as `COMPLETE` before promotion finished is treated as `PARTIAL`,
not as commercial success. When bootstrap services are configured, missing lifecycle
metadata is invalid and `NOT_APPLICABLE` cannot satisfy a completed installation.

The operational controller independently requires current AppSheet readiness and a
successful installer verification before returning `OPERATIONAL_INSTALLATION_COMPLETE`.
An incomplete promotion returns the bounded code `ACCESS_PROMOTION_INCOMPLETE`.
Persistence ambiguity returns `UNKNOWN`.

## Failure-injection coverage

The Apps Script runtime tests cover failures at these boundaries:

- write of the second access table;
- `SpreadsheetApp.flush()`;
- read-back after an access-table write;
- durable `COMPLETE` state write;
- interruption after state persistence and before bootstrap consumption;
- interruption after bootstrap consumption and before permission promotion;
- bootstrap consumption, including renewal after a split claim/confirmation state;
- retry after a mixed restricted/promoted row set;
- rejection of recovery by a different OIDC subject;
- rejection of a completed installation whose lifecycle evidence was deleted;
- duplicate access row;
- altered access row;
- foreign-tenant access row;
- recovery of the legacy premature-`COMPLETE` condition.

Every failed path remains `INCOMPLETE`, denies `canAccess()` and either preserves a
recognized retry state or rejects the target without mutation.

## Security invariants

- Default DENY remains unchanged.
- DENY precedence remains unchanged.
- AERP-036/AERP-037 remain authoritative.
- Navigation and visibility never grant authorization.
- The 17-table AERP-040 blueprint is unchanged.
- Tenant identifiers are checked in durable state, bootstrap evidence and every
  promoted access row.
- The OIDC subject, issuer, target, tenant, plan and configuration bindings remain
  immutable across renewal and retry.
- No client-specific identity or commercial data is hardcoded.

## Verification on the clean candidate

Canonical runtime: Node `24.18.0`, npm `11.16.0`.

| Check                           | Result                                                |
| ------------------------------- | ----------------------------------------------------- |
| Product test gate               | **367/367 PASS**, 10 declared suites                  |
| Apps Script runtime tests       | **42/42 PASS**                                        |
| Operational controller tests    | **16/16 PASS**                                        |
| ESLint                          | PASS, zero warnings                                   |
| Prettier                        | PASS                                                  |
| Globals audit                   | PASS: 829 symbols, 0 collisions, 0 dynamic violations |
| Globals Gate autotests          | **37 PASS**, 2 platform skips                         |
| Bundle manifest                 | PASS: 45 scripts, 46 artifact files                   |
| Bundle Gate autotests           | **18/18 PASS**                                        |
| `git diff --check`              | PASS                                                  |
| Husky/lint-staged during commit | PASS; no bypass was used                              |
| `npm audit`                     | 0 critical, 0 high, 4 moderate tooling findings       |

The canonical test evidence was regenerated against the code committed as `02bcaf1`.
At execution time, the only separate staged change was this evidence document; no
product-code change remained outside that commit.

The self-test gate reports **41/42** inside the restricted Windows host. Its sole
failure is the inherited real `taskkill.exe` process-tree confirmation test; all
simulated termination, evidence and aggregation cases pass. The command was also
run from the normal developer terminal before the commit, but its complete output is
not stored in repository evidence, so this document does not claim an independently
captured 42/42 result.

The current lockfile audit offers a major downgrade to ESLint 9 as the automatic fix
for the four remaining moderate `eslint`/`minimatch` tooling findings. That downgrade
was not applied because it is outside this functional correction and requires a
separate compatibility decision.

## Remaining delivery actions

This candidate is ready for independent code review, not yet for an assertion that a
commercial installation has completed. The remaining authorized sequence is:

1. obtain independent Claude and Qwen review of commit `02bcaf1`;
2. resolve any genuine merge blockers;
3. request separate authorization for PR and merge into the release branch;
4. request separate authorization for deployment to the approved isolated Apps
   Script project;
5. configure the approved Script Properties in that isolated project;
6. execute the complete installation against the approved isolated Google Sheet;
7. configure and validate the AppSheet Core application for all 17 tables;
8. retain the real installation, failure-recovery and AppSheet evidence;
9. confirm the durable state reaches `COMPLETE` before presenting the pilot.

Until steps 4–9 are performed, the result is a fully tested release candidate for an
assisted pilot, not a completed real-world installation.
