# AERP-REL-001 — Alef ERP 3.0.0 Pilot Release Candidate

## 1. Decision

Alef ERP 3.0.0 RC1 has completed its isolated non-production pilot execution with
the expected operational result. This record authorizes neither production
deployment nor client access; those remain separate business decisions.

```text
PILOT CANDIDATE PREPARATION: PASS
ISOLATED PILOT OPERATIONAL VALIDATION: PASS
PRODUCTION DEPLOYMENT: NOT AUTHORIZED
CLIENT ACTIVATION: NOT AUTHORIZED BY THIS RECORD
```

## 2. Candidate identity

- Candidate branch: `release/AlefERP-3.0.0-rc1`
- Operationally validated release revision: `4a295e021ac7c67a6173693b6317f954464608b9`
- Candidate code revision: `4f392de5bf7dc02d3f242b26da73f10264d68a13`
- Previously operationally tested revision: `5b42e13486874ba5e5edcccc9957380bb93aea96`
- Product version: `3.0.0`
- Runtime: Google Apps Script V8 bound to Google Sheets
- Execution topology: saved HEAD code from the bound pilot project
- Versioned web/API deployment: not applicable to this pilot candidate
- Installable triggers: none identified in the commercial bundle

Revision `4a295e0` adds release documentation over the product code in `4f392de`;
the versioned commercial artifact identity is unchanged. Spreadsheet access resolves
exclusively through `SpreadsheetApp.getActiveSpreadsheet()` and contains no fixed
spreadsheet ID or `openById` fallback.

## 3. Commercial scope

The first pilot delivers the primary generation path exposed as
`Alef ERP → Generar ERP` and implemented by `runGenerarERP`.

The validated outcome is:

- 23 tables
- 276 columns
- 23 forms
- 23 views
- 23 menus
- 92 AppSheet package artifacts
- 0 operational warnings
- `CORE_COLUMNAS` structural preservation
- isolation between the dedicated pilot and the existing DEV spreadsheet

The workflow entry point, metadata rebuild entry point, dry run, legacy entry points,
client activation, and production deployment are not part of this validation.

## 4. Candidate gates and controlled activation

The following local controls were executed on 2026-09-11 against the clean candidate
code in `4f392de`:

| Control                     | Result                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| `npm test`                  | PASS — 242/242, six suites, zero failures or skips                            |
| `npm run qa:globals`        | PASS — 759 symbols, 779 occurrences, zero duplicates, zero dynamic violations |
| `npm run test:bundle`       | PASS — 17/17 and manifest validation                                          |
| Commercial inventory        | PASS — 37 scripts and `appsscript.json`, 38 files total                       |
| Embedded test removal       | PASS — 102 entry points and one technical self-export removed                 |
| Spreadsheet-isolation tests | PASS — active bound container only; no-ID context fails closed                |

The following external operations were then completed under separate authorization:

| Operation                    | Result                                                                |
| ---------------------------- | --------------------------------------------------------------------- |
| Pilot backup                 | PASS — private pre-run spreadsheet copy preserved                     |
| Corrected bundle push        | PASS — 38-file RC1 bundle sent only to the dedicated pilot script     |
| Remote isolation inspection  | PASS — no fixed spreadsheet ID or `openById` fallback                 |
| Authorized operational run   | PASS — exactly one `runGenerarERP`, completed in 34.94 seconds        |
| Authoritative deployment log | PASS — one new `OK` receipt with expected counts and zero warnings    |
| Pilot/DEV isolation          | PASS — pilot received the receipt; DEV received no 2026-09-11 receipt |
| Backup preservation          | PASS — pre-run receipt count and structural counts remained unchanged |

Local JSON evidence remains ephemeral and Git-ignored under `.qa-output/`. The
sanitized durable operational record is
`EVIDENCE-AERP-REL-001-RC1-Pilot-2026-09-11.md`.

## 5. Canonical artifact identity

The candidate artifact is identified by the versioned bundle gate using ordered
repository-relative paths and each file's SHA-256:

```text
0ed03fb36b945cf920f0ab4f0de78bf4d0df7ae4affcdeb04015382eb5849073
```

Two consecutive clean reconstructions produced this exact hash. The corrected bundle
deployed to the pilot contained the same 37 scripts and `appsscript.json` described by
the approved manifest.

The repository now defines LF endings for JavaScript, JSON, Markdown, and QA script
files through `.gitattributes`. This prevents `core.autocrlf` from changing artifact
bytes between Windows checkouts while preserving product semantics.

The earlier operational record contains `c5b30ce4…`. Its hashing procedure was not
versioned and cannot be equated to the bundle gate's ordered artifact digest. It is
therefore retained only as the identity recorded for that earlier operational session.

## 6. Current operational evidence

The controlled execution recorded in
`EVIDENCE-AERP-REL-001-RC1-Pilot-2026-09-11.md` confirmed:

- exactly one completed `runGenerarERP` execution;
- one authoritative new `OK` receipt in the pilot;
- 23 tables, 276 columns, 23 forms, 23 views, and 23 menus;
- 92 AppSheet package artifacts;
- zero warnings;
- preservation of 276 `CORE_COLUMNAS` records;
- preservation of the private pre-run backup; and
- no corresponding receipt or observable operational write in the existing DEV
  spreadsheet.

The prior execution in
`EVIDENCE-AERP-039-MVP-Runtime-Consolidation-2026-09-10.md` remains historical
evidence for `5b42e13`; it is not substituted for the current isolated validation.

The secondary `AERP_BUILD` sheet displayed the correct state, version, table, form,
view, menu, warning, and duration values, but its `Columnas` summary cell remained
visually blank. The authoritative receipt, `CORE_COLUMNAS`, and AppSheet package all
independently reported the expected 276-column result. This is recorded as a
non-blocking presentation follow-up and not as evidence of missing generated data.

This validation does not claim cryptographic cell-by-cell equality, workflow
validation, client acceptance, or production validation.

## 7. Pilot activation controls

| Control                                              | Status     |
| ---------------------------------------------------- | ---------- |
| Dedicated pilot spreadsheet and bound script         | Complete   |
| Private pre-run spreadsheet backup                   | Complete   |
| Canonical artifact reconstruction and hash           | Complete   |
| 38-file allowlist and controlled pilot-only push     | Complete   |
| Remote container-isolation inspection                | Complete   |
| Separate authorization for one operational execution | Complete   |
| Expected counts, `OK` receipt, and zero warnings     | Complete   |
| Pilot/DEV isolation                                  | Complete   |
| Sanitized operational evidence                       | Complete   |
| Client access decision                               | Pending    |
| Production deployment authorization                  | Prohibited |

## 8. Pilot rollback

The pilot uses bound-script HEAD execution. If later validation or client acceptance
fails:

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

The isolated RC1 pilot has passed its controlled operational validation. No additional
`runGenerarERP` execution is required to document this result. The next decision is
whether to authorize limited client access to the isolated pilot under the agreed
commercial scope. Production deployment remains prohibited.
