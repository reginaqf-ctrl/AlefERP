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
- Approved Git base: `4f392de5bf7dc02d3f242b26da73f10264d68a13`
- Candidate code revision: `4f392de5bf7dc02d3f242b26da73f10264d68a13`
- Previously operationally tested revision: `5b42e13486874ba5e5edcccc9957380bb93aea96`
- Product version: `3.0.0`
- Runtime: Google Apps Script V8 bound to Google Sheets
- Execution topology: saved HEAD code through `onOpen` and the `Alef ERP` menu
- Versioned web/API deployment: not applicable to this pilot candidate
- Installable triggers: none identified in the commercial bundle

The candidate adds a fail-closed container-isolation correction after the previously
successful non-production execution. Spreadsheet access now resolves exclusively
through `SpreadsheetApp.getActiveSpreadsheet()` and contains no fixed spreadsheet ID
or `openById` fallback. This correction has passed local automated gates but has not
yet been executed operationally in Apps Script.

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
`4f392de` candidate revision:

| Control                           | Result                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm test`                        | PASS — 242/242, six suites, zero failures or skips                            |
| `npm run qa:globals`              | PASS — 759 symbols, 779 occurrences, zero duplicates, zero dynamic violations |
| `npm run test:bundle`             | PASS — 17/17 and manifest validation                                          |
| Commercial inventory              | PASS — 37 scripts and `appsscript.json`, 38 files total                       |
| Embedded test removal             | PASS — 102 entry points and one technical self-export removed                 |
| Spreadsheet-isolation tests       | PASS — active bound container only; no-ID context fails closed                |
| Clasp preparation                 | NOT EXECUTED for the corrected candidate                                      |
| Apps Script or spreadsheet writes | NOT EXECUTED during candidate preparation                                     |

Local JSON evidence remains ephemeral and Git-ignored under `.qa-output/`.

## 5. Canonical artifact identity

The candidate artifact is identified by the versioned bundle gate using ordered
repository-relative paths and each file's SHA-256:

```text
0ed03fb36b945cf920f0ab4f0de78bf4d0df7ae4affcdeb04015382eb5849073
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

The earlier non-production execution recorded in
`EVIDENCE-AERP-039-MVP-Runtime-Consolidation-2026-09-10.md` confirmed:

- successful primary commercial generation;
- one authoritative `OK` receipt;
- zero warnings;
- the expected table, column, form, view, menu, and package counts;
- retention of the four approved backups; and
- structural preservation of `CORE_COLUMNAS`.

That execution predates the container-isolation correction. The candidate does not
claim an operational result for `4f392de`, cryptographic cell-by-cell equality,
workflow validation, or production validation.

## 7. Pilot activation preconditions

Before the candidate is activated for a client pilot:

1. Confirm the existing dedicated pilot spreadsheet and bound Apps Script project.
2. Preserve the private pre-run spreadsheet backup already created for this pilot.
3. Record sanitized identifiers outside Git in the operator's protected release record.
4. Rebuild the artifact from `4f392de` and require the canonical hash above.
5. Prepare clasp only for the dedicated pilot project and confirm the 38-file allowlist.
6. Replace the earlier pilot bundle with this corrected candidate after authorization.
7. Open the pilot sheet and confirm the menu without running the generation path.
8. Obtain separate authorization immediately before one `runGenerarERP` execution.
9. Require the validated counts, one `OK` receipt, zero warnings, and preserved backups.
10. Stop and roll back on any mismatch; do not continue to client activation.

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

The isolated pilot copy and its private pre-run backup already exist. The earlier RC1
bundle was pushed to the pilot, but no operational generation was executed after the
fixed-ID risk was found. The next externally mutating step is a separately controlled
push of the corrected `4f392de` bundle exclusively to that pilot script. Operational
generation remains prohibited until separately authorized after the corrected remote
bundle is verified.
