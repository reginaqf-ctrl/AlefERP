# AERP-QA-001 — Release and Rollback Runbook

## 1. Purpose and authorization

This runbook defines release and recovery controls for Alef ERP. It does not by itself authorize clasp, deployment, client access, or any Git mutation.

Current disposition: **GO for preparation of the isolated AERP-REL-001 commercial pilot candidate**. Production deployment and client activation remain **NO-GO** until separately authorized. AERP-QA-001 remains open for the broader release controls that are not required to prepare the isolated candidate.

## 2. Roles

- **Release owner:** gates, decision record, and recovery coordination.
- **Technical reviewer:** architecture, bundle, order, and diff.
- **Security reviewer:** authorization and tenant boundaries.
- **Operator:** performs separately approved synchronization/release actions.
- **Validator:** independently verifies candidate and recovery.

## 3. Mandatory preconditions

- Every structural blocker and Definition of Done item is closed.
- All future commands in the Engineering Standard are implemented and versioned.
- `eslint . --max-warnings=0`, Prettier, targeted tests, full tests, global audit, bundle-manifest check, and exact-artifact tests pass.
- `git diff --check <approved-base>...HEAD` passes for resolved revisions.
- The separate untracked inventory is empty or exactly approved.
- A positive bundle manifest matches the reproducible sorted clasp file listing and hashes.
- `eslint.config.js`, all six `*.test.js`, and all other Node/test-only files are excluded.
- Canonical order and `filePushOrder`, where applicable, are approved.
- The exact candidate is validated in non-production.
- Runtime topology and owners are inventoried: versioned deployments, HEAD paths, menus/custom functions, and simple/installable triggers.
- Known-good targets and recovery procedures for each topology are rehearsed.

Any false or unevidenced precondition is **NO-GO**.

## 4. Release record

```text
Work item:
Approved base and candidate revision:
Positive bundle manifest version:
Sorted bundle listing and artifact hash:
Canonical order / filePushOrder:
Apps Script project and topology:
Versioned deployment IDs and versions:
HEAD recovery target and procedure:
Menus and custom functions inventory:
Simple and installable trigger inventory and owners:
Release owner / operator / validator / approvers:
Start and rollback-decision times (UTC):
Evidence location:
```

The record MUST NOT contain credentials, tokens, personal data, or sensitive business identifiers.

## 5. Future release procedure

1. Resolve and record the approved Git base, candidate revision, and clean-checkout provenance.
2. Execute every gate using the exact inputs specified in the Engineering Standard.
3. Generate the positive-manifest comparison, sorted publication listing, canonical order, and artifact hash.
4. Stop on any collision, unapproved file, missing file, order difference, test-only entry point, or hash mismatch.
5. Validate the exact artifact in a dedicated non-production Apps Script project across every inventoried runtime path.
6. Obtain technical, security, release, and operational approval.
7. Under separate authorization, create the appropriate immutable version and update only the approved topology.
8. Validate versioned endpoints, HEAD paths, menus/custom functions, and triggers as applicable.
9. Monitor through the recorded decision window and preserve sanitized evidence.

## 6. Rollback triggers

Rollback is mandatory for an unauthorized allow, tenant-boundary failure, contract mismatch, bundle/revision mismatch, unexpected published file, test-only reachability, initialization or critical workflow failure, threshold breach, unavailable telemetry, or inability to prove the active version/HEAD state.

## 7. Topology-specific rollback

### 7.1 Versioned deployments

1. Record the active deployment ID and failing version.
2. Edit the same approved deployment to reference the recorded immutable known-good version.
3. Verify deployment ID, resolved version, endpoint behavior, authorization denies, and tenant isolation.
4. Do not assume this action changes HEAD, menus, custom functions, or triggers.

### 7.2 Code executed from HEAD

1. Identify every editor/API/development or bound-script path using current saved code.
2. Pause affected operations where an approved fail-closed mechanism exists.
3. Restore the recorded known-good source snapshot to HEAD through a separately approved recovery action.
4. Verify the saved HEAD file inventory and hash before re-enabling use.
5. Repeat initialization, authorization, metadata, and workflow smoke tests.

Changing a versioned deployment alone does not complete this rollback.

### 7.3 Menus and custom functions

1. Record the bound container, menu entry points, custom function names, and expected HEAD revision.
2. Complete the HEAD recovery first.
3. Reopen or refresh the bound container to re-run approved initialization such as `onOpen`.
4. Verify menu construction, each critical action, custom-function results, authorization, and tenant isolation.
5. Communicate spreadsheet recalculation or refresh requirements to affected users.

### 7.4 Simple and installable triggers

1. Inventory trigger type, handler, event source, owner, authorization identity, and enabled state before release.
2. For simple triggers, recover and validate the corresponding HEAD handler and event path.
3. For installable triggers, verify owner and configuration; disable only under explicit incident authority if unsafe execution continues.
4. After HEAD recovery, recreate or re-enable installable triggers only from the approved inventory and with approved authority.
5. Execute controlled trigger events and verify idempotency, authorization, tenant isolation, logs, and absence of duplicate triggers.

## 8. Failed recovery and data safety

If any topology cannot be restored or validated, keep it disabled through an approved fail-closed control, escalate to release and security owners, preserve evidence, and keep the incident open. Code rollback does not authorize data restoration. Metadata or data recovery requires a separate source-specific, approved plan.

## 9. Recovery evidence and closure

For each topology, record responsible person, start/end UTC, failing and restored identifiers, source/bundle hashes, trigger inventories, commands or UI controls, smoke outcomes, deviations, and approvals. Close the incident only when all affected paths meet recovery objectives and the validator confirms security behavior.

NIST SP 800-53 contingency guidance requires plans to be tested and results reviewed; OWASP secure-deployment guidance supports controlled deployment and recovery practices.

## 10. References

Consulted **2026-08-24**:

- [Google Apps Script deployments](https://developers.google.com/apps-script/concepts/deployments)
- [Google Apps Script versions](https://developers.google.com/apps-script/guides/versions)
- [Google Apps Script bound scripts](https://developers.google.com/apps-script/guides/bound)
- [Google Apps Script installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- [clasp configuration files](https://github.com/google/clasp/blob/master/docs/config-files.md)
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Developer Guide: Secure Deployment](https://devguide.owasp.org/en/05-implementation/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
