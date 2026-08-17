# AERP-038A MetadataModel 1.0.0 — Operational Migration Guide

## 1. Purpose and scope

This guide defines the operational controls required to audit and, when necessary, migrate legacy Primary Key metadata before activating the AERP-038A strict Metadata Builder wrapper in an environment.

It applies to contract version `1.0.0`. It contains no executable code, temporary tooling or business-specific data. It does not authorize a migration by itself.

The number of eligible or migrated PKs is environment-specific. The historical count of 23 belongs only to the validated environment described in section 16 and is not a universal precondition, expected count or migration target.

## 2. Required roles and authorization

The operation requires:

- an authorized release owner who approves the environment and maintenance window;
- a metadata owner who approves the intended PK type for every affected table;
- an operator with controlled access to the target Apps Script project and metadata spreadsheet;
- a reviewer who verifies the backup, sanitized evidence and post-migration results.

The operator must not infer authorization from access permissions. Approval, scope and rollback ownership must be recorded before any change.

## 3. Preconditions

Before the audit or migration:

1. Identify the target environment unambiguously.
2. Record the deployed code version or commit.
3. Establish a controlled maintenance window.
4. Confirm that no metadata generation, installation, pipeline or concurrent editing process is running.
5. Define who can authorize continuation and who can order rollback.
6. Create and verify a complete backup of `CORE_COLUMNAS`.
7. Confirm that the previous `14_MetadataBuilder.gs` version can be restored if the wrapper has already been replaced.

Failure to satisfy any precondition blocks the operation.

## 4. Mandatory pre-migration audit

Run the read-only compatibility audit:

```text
testMetadataBuilderEnterpriseCompatibilityAudit
```

Record only its sanitized result, contract version and counters. Do not record complete metadata, table names, column names, formulas, business values, exceptions or stack traces.

The audit must be executed before activating the strict wrapper in every environment. Evidence from one environment cannot authorize or validate another.

## 5. Identifying incompatible legacy PK metadata

Review active columns explicitly declared as PKs through `Es_Key:true`. For each affected table, confirm:

- exactly one active PK exists;
- its current `Tipo_Dato` is known;
- its stored values have been classified without conversion;
- its intended identity semantics have been approved.

Under contract version `1.0.0`, only `Text` and `Number` are valid PK types. `Ref` is not a valid PK type. Legacy PK metadata using `Ref` is incompatible and must not reach the strict wrapper unchanged.

No PK may be inferred from an `ID_*` name, column position or any other fallback. No label may be inferred from `Nombre`, `Codigo` or another name.

## 6. Type decision by environment

The metadata owner must approve each PK decision using the environment's real storage characteristics:

- Select `Text` for UUIDs, codes and alphanumeric identifiers.
- Select `Number` only for real finite integer numbers whose numeric identity semantics are intentional.
- `NUMERIC_TEXT` remains text. It must not be converted automatically to `Number`, because leading zeros or textual identity semantics may be significant.
- Mixed values block migration.
- Incompatible values or types block migration.
- Unsupported values block migration.
- Read failures block migration.
- Empty-only storage without an approved identity convention blocks migration.

Classification describes storage evidence; it does not by itself authorize a target type.

## 7. Prohibition on blind conversion

Do not convert every PK to the same type and do not use an environment-specific count as a universal selector. Each affected PK requires explicit eligibility, evidence and approval.

No temporary migration tool is part of this guide or of the deliverable.

## 8. Required backup

Before changing metadata, create a complete backup of `CORE_COLUMNAS`.

The backup must:

- include the entire sheet, not only eligible rows;
- have a unique, traceable identifier;
- be readable and complete;
- be retained until the release and rollback window are formally closed;
- be verified before migration begins.

A backup that cannot be identified or verified blocks migration.

## 9. Controlled metadata migration

Migration is limited to the `Tipo_Dato` cells of explicitly approved PK rows.

For every approved row:

- the original type must match the reviewed legacy condition;
- the target must be exactly `Text` or `Number`;
- the approved row set must remain stable between review and change;
- the resulting value must be verified after the change.

Do not modify:

- `Es_Key`;
- `Es_Ref`;
- `Activo`;
- `Tabla_Referencia`;
- any other metadata field;
- any stored business or PK value.

Any ambiguity, concurrent change or mismatch between the approved and actual row set requires an immediate abort.

## 10. Strict wrapper activation

The strict wrapper may be activated only after:

- the backup has been verified;
- all incompatible PK metadata has an approved decision;
- the controlled migration has completed successfully;
- no blocking storage classification remains;
- the environment and code version still match the approved scope.

Replacing `14_MetadataBuilder.gs` must be treated as a separate controlled release step with the previous version retained for rollback.

## 11. Post-migration verification

Run, in order:

1. `testMetadataBuilderEnterpriseCompatibilityAudit`;
2. `testMetadataBuilder`;
3. `testGeneratorEngineMVP`.

Capture only sanitized counters and outcomes. Do not include metadata, names, formulas, values, private errors or stack traces.

## 12. Success criteria

The operation succeeds only when:

- the contractual audit returns `ok:true`;
- errors and warnings are both zero unless an explicitly approved contract warning is expected;
- PK and FK counters are internally consistent with the approved environment baseline;
- Metadata Builder completes successfully;
- Generator produces its expected tables, forms, views and menus without errors;
- the backup remains available and verified;
- no prohibited field or data value changed;
- the evidence record is complete.

## 13. Abort criteria

Abort without activating or continuing the wrapper when:

- authorization, environment identity or code version is uncertain;
- a backup is missing, incomplete or unverifiable;
- concurrent activity cannot be excluded;
- the audit reports an error or an unapproved warning;
- PK storage is mixed, unsupported or unreadable;
- empty-only storage has no approved convention;
- eligible rows or counts change unexpectedly;
- a proposed target type lacks explicit approval;
- any prohibited metadata field or stored value changes;
- post-migration verification differs from the approved baseline.

An abort must be recorded and must not be converted into an implicit exception to the contract.

## 14. Rollback

If migration, activation or verification fails:

1. Stop wrapper activation and all dependent generation activity.
2. Restore `CORE_COLUMNAS` from the verified backup.
3. If `14_MetadataBuilder.gs` was replaced, restore its previous approved version.
4. Repeat `testMetadataBuilderEnterpriseCompatibilityAudit`.
5. Verify that the restored environment matches the pre-operation baseline.
6. Preserve the rollback result and all sanitized evidence.

Do not delete or overwrite the backup as part of rollback.

## 15. Minimum evidence

Retain:

- operation date and controlled window;
- environment identifier;
- authorizing roles or approval reference;
- sanitized pre- and post-operation counters;
- backup name or identifier;
- audit outcomes;
- code version or commit;
- Metadata Builder and Generator outcomes;
- abort reason, if applicable;
- rollback result, if applicable.

Evidence must not contain business names, column names, PK values, formulas, complete metadata, private exceptions or stack traces.

## 16. Sanitized historical note for the validated environment

In the already validated environment:

- 23 PK metadata rows were migrated;
- the prior storage classification was 14 `TEXT` and 9 `EMPTY_ONLY`;
- subsequent validation reported 23 PK, 30 resolved FK and zero errors or warnings;
- the complete backup was retained.

These figures document one completed environment only. They are not preconditions, expected counts or authorization for another environment.
