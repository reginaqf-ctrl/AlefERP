# AERP-REL-001 — Alef ERP 3.0.0 Pilot Release Candidate

## 1. Decision

Alef ERP 3.0.0 is ready to be packaged as an isolated commercial pilot candidate.
This record does not authorize a production deployment, client access, `clasp push`,
or an operational execution against a new spreadsheet.

```text
PILOT CANDIDATE PREPARATION: PASS
PRODUCTION DEPLOYMENT: NOT AUTHORIZED
CLIENT ACTIVATION: NOT AUTHORIZED
```

## 2. Candidate identity

- Candidate branch: `release/AlefERP-3.0.0-rc1`
- Approved Git base: `7d1efac697e0c85cc25094d00cf10d921fe0b692`
- Operational code revision: `5b42e13486874ba5e5edcccc9957380bb93aea96`
- Product version: `3.0.0`
- Runtime: Google Apps Script V8 bound to Google Sheets
- Execution topology: saved HEAD code through `onOpen` and the `Alef ERP` menu
- Versioned web/API deployment: not applicable to this pilot candidate
- Installable triggers: none identified in the commercial bundle

The only Git delta from the operationally tested revision to the approved base is
`EVIDENCE-AERP-039-MVP-Runtime-Consolidation-2026-09-10.md`. No product source file
changed after the successful non-production execution.

## 3. Commercial scope

The first pilot delivers the primary generation path exposed as
`Alef ERP → Generar ERP`.

The validated outcome is:

- 23 tables
- 276 columns
- 23 forms
- 23 views
- 23 menus
- 92 AppSheet package artifacts
- 0 operational warnings
- `CORE_COLUMNAS` structural preservation

The workflow entry point, metadata rebuild entry point, dry run, legacy entry points,
and production deployment are not part of the first pilot activation.

## 4. Candidate gates executed on the approved base

The following controls were executed locally on 2026-09-11 against the clean
`7d1efac` base:

| Control                           | Result                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm test`                        | PASS — 239/239, six suites, zero failures or skips                            |
| `npm run qa:globals`              | PASS — 760 symbols, 780 occurrences, zero duplicates, zero dynamic violations |
| `npm run test:bundle`             | PASS — 17/17 and manifest validation                                          |
| Commercial inventory              | PASS — 37 scripts and `appsscript.json`, 38 files total                       |
| Embedded test removal             | PASS — 102 entry points and one technical self-export removed                 |
| Clasp preparation                 | NOT EXECUTED                                                                  |
| Apps Script or spreadsheet writes | NOT EXECUTED during candidate preparation                                     |

Local JSON evidence remains ephemeral and Git-ignored under `.qa-output/`.

## 5. Canonical artifact identity

The candidate artifact is identified by the versioned bundle gate using ordered
repository-relative paths and each file's SHA-256:

```text
9d8275ac28c640e3007f2b209456342637cfc6a4e8ea1796f2d258a8ade9157e
```

Two consecutive clean reconstructions produced this exact hash.

The repository now defines LF endings for JavaScript, JSON, Markdown, and QA script
files through `.gitattributes`. This prevents `core.autocrlf` from changing artifact
bytes between Windows checkouts while preserving product semantics.

The earlier operational record contains `c5b30ce4…`. Its hashing procedure was not
versioned and cannot be equated to the bundle gate's ordered artifact digest. It is
therefore retained only as the identity recorded for that operational session; it is
not the canonical identity of this release candidate. The successful 38/38 remote
comparison and operational results remain valid observations for that session.

## 6. Operational evidence inherited by the candidate

The non-production execution recorded in
`EVIDENCE-AERP-039-MVP-Runtime-Consolidation-2026-09-10.md` confirmed:

- successful primary commercial generation;
- one authoritative `OK` receipt;
- zero warnings;
- the expected table, column, form, view, menu, and package counts;
- retention of the four approved backups; and
- structural preservation of `CORE_COLUMNAS`.

The candidate does not claim cryptographic cell-by-cell equality, workflow validation,
or production validation.

## 7. Pilot activation preconditions

Before the candidate is activated for a client pilot:

1. Create a dedicated pilot copy of the spreadsheet and its bound Apps Script project.
2. Record sanitized identifiers outside Git in the operator's protected release record.
3. Confirm a pre-activation spreadsheet backup and a known-good Apps Script HEAD copy.
4. Rebuild the artifact from the candidate revision and require the canonical hash.
5. Prepare clasp only for the dedicated pilot project and confirm the 38-file allowlist.
6. Obtain explicit authorization immediately before `clasp push`.
7. Open the pilot sheet, confirm the menu, and execute the primary generation path once.
8. Require the validated counts, one `OK` receipt, zero warnings, and preserved backups.
9. Stop and roll back on any mismatch; do not continue to client activation.

## 8. Pilot rollback

The pilot uses bound-script HEAD execution. If validation fails:

1. Remove client access or keep the isolated copy inaccessible.
2. Restore the recorded known-good Apps Script HEAD snapshot.
3. Restore spreadsheet data only from the dedicated pre-activation backup and only
   with separate authorization.
4. Reopen the spreadsheet to rebuild the menu.
5. Re-run read-only inventory checks before any further operational execution.
6. Preserve a sanitized failure record and keep production deployment disabled.

Rollback of a versioned web deployment is not applicable because this candidate does
not create one. No trigger recreation is required unless a later release explicitly
adds installable triggers.

## 9. Remaining decision

The next externally mutating step is creation of the isolated pilot copy and a
separately authorized push of this exact candidate bundle. Until that authorization is
given, the candidate remains prepared locally and no production or client system is
changed.
