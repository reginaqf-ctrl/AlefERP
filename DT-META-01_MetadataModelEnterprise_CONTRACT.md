# DT-META-01 — MetadataModel Enterprise Contract

**Ticket:** AERP-038A

**Contract version:** 1.0.0

**Status:** Implementation candidate

**Scope:** Pure FrameworkSchema validation and neutral MetadataModel construction

## 1. Purpose

This contract defines the strict, deterministic and fail-closed boundary between the existing `FrameworkSchema` and the neutral enterprise `MetadataModel`.

The public pure API is:

```javascript
aerpBuildMetadataModelFromSchema(schema);
```

It accepts one argument. Strict validation cannot be disabled. The function does not access Apps Script services, clocks, UUID generators, properties or mutable global state, and it never mutates its input.

## 2. Result contract

```javascript
{
  ok: boolean,
  contractVersion: "1.0.0",
  model: MetadataModel | null,
  diagnostics: Diagnostic[],
  summary: MetadataBuildSummary
}
```

Any `ERROR` sets `ok:false` and `model:null`. A partial model is never returned. Unexpected exceptions are replaced by one sanitized `MBE_INTERNAL_ERROR` diagnostic.

A diagnostic contains exactly:

```javascript
{
  code: string,
  severity: "ERROR" | "WARNING",
  path: string,
  message: string
}
```

Diagnostic paths use zero-based input indexes. Diagnostics are ordered by severity, code, path and message.

## 3. FrameworkSchema input

The root is a plain object with exactly these fields:

| Field         | Type                                     | Required | Rule                                                  |
| ------------- | ---------------------------------------- | -------: | ----------------------------------------------------- |
| `version`     | non-empty string                         |      Yes | Trimmed; preserved as source schema version           |
| `generatedAt` | valid `Date` or ISO date string          |      Yes | Validated and normalized only for boundary validation |
| `tables`      | dense ordinary array of `FrameworkTable` |      Yes | No accessors or additional properties                 |
| `summary`     | plain `FrameworkSummary`                 |      Yes | Validated but counters are not trusted                |

`FrameworkSummary` contains exactly:

| Field                                     | Type                       |
| ----------------------------------------- | -------------------------- |
| `tables`, `columns`, `relations`, `views` | non-negative integers      |
| `warnings`, `errors`                      | dense arrays of strings    |
| `durationMs`                              | non-negative finite number |

Non-empty `summary.errors` produces `MBE_UPSTREAM_SCHEMA_ERROR`; original upstream messages are not copied. Table and column counters are recalculated. A mismatch produces `MBE_SUMMARY_MISMATCH`.

### 3.1 FrameworkTable

A table is a plain object with exactly:

```text
id, code, name, entity, module, category, type,
physicalName, prefix, active, columns
```

| Field                                                    | Type                 | Required rule                                      |
| -------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| `id`, `code`, `physicalName`                             | non-empty string     | Required and unique after trimming                 |
| `name`, `entity`, `module`, `category`, `type`, `prefix` | string               | May be empty                                       |
| `active`                                                 | boolean              | No coercion                                        |
| `columns`                                                | dense ordinary array | Required; may be empty only when table is inactive |

Table `id`, `code` and `physicalName` are independently unique. Comparisons are exact after trimming; case and spelling are not inferred.

`active:true` requires full structural validation and exactly one explicit PK. `active:false` is retained and does not require columns, PK or label.

The schema has no normative discriminator for business, system, bridge or view tables. Every table is therefore emitted with:

```javascript
classification: 'UNCLASSIFIED';
```

Names, prefixes, modules, categories and types are never used as classification heuristics.

### 3.2 FrameworkColumn

A column is a plain object. Approved fields are:

```text
ID_Columna, Tabla, Nombre_Campo, Nombre_Mostrar,
Tipo_Dato, Tipo_Control, Es_Key, Es_Label, Es_Requerido,
Permite_Nulos, Valor_Inicial, Formula_App, Tabla_Referencia,
Longitud, Orden, Activo, Estado, Fecha_Creacion,
Fecha_Actualizacion, Visible, Editable, Es_Ref, Es_Virtual,
Es_Buscable, Es_Filtrable, Es_Ordenable, Es_Indexado,
Grupo_Formulario, Ayuda, Placeholder
```

Identity and structure:

- `ID_Columna`, `Tabla` and `Nombre_Campo` are non-empty strings.
- `ID_Columna` is globally unique.
- `Nombre_Campo` is unique within its table.
- `Tabla` exactly equals the containing table's `physicalName`.
- `Orden` is a unique positive integer within its table.
- Required booleans are actual booleans; strings and numbers are not coerced.
- `Es_Buscable`, `Es_Filtrable`, `Es_Ordenable` and `Es_Indexado` may be absent and then receive the safe default `false` with a warning.
- `Formula_App` is opaque text. It is not parsed or executed.

Supported `Tipo_Dato` values:

```text
Text, LongText, Number, Decimal, Price, Percent,
Date, DateTime, Time, YesNo, Email, Phone, URL,
Image, File, Enum, EnumList, Ref, LatLong, Color
```

Only these legacy aliases are normalized:

```text
Yes/No   -> YesNo
Long Text -> LongText
```

## 4. Primary Key invariants

- An active table has exactly one active column with `Es_Key:true`.
- Composite PKs are not supported in 1.0.0.
- The only valid PK types in contract version 1.0.0 are `Text` and `Number`.
- `Ref` is not permitted as a PK type in contract version 1.0.0.
- `Email` and all other types are rejected as PK types.
- A PK is required, non-nullable, non-virtual and active.
- PK plus FK on the same column is rejected under ADR-002.
- No `ID_*`, first-column or position fallback exists.
- No `Nombre`, `Codigo` or other name-based fallback exists for PK or label resolution.

An inactive table does not require a PK. An inactive column cannot declare an effective PK.

Legacy metadata that uses `Ref` as a PK is potentially incompatible with this contract. It must be audited and migrated under an approved, backed-up and reversible operational procedure before the strict production wrapper is activated in another environment. The required operational controls are defined in `MIGRATION-AERP-038A-MetadataModel-v1.0.0.md`.

## 5. Label invariants

Label is optional neutral metadata:

- zero labels is valid;
- one active label is valid;
- multiple active labels are an error;
- `EnumList` is not a valid scalar label type;
- no `Nombre`, `Codigo` or other name fallback exists.

Platform-specific label requirements are outside AERP-038A.

## 6. Foreign Key invariants

- Only `Es_Ref:true` declares an FK.
- `Tabla_Referencia` must exactly equal one active table's `physicalName`.
- The destination column is that table's unique valid PK.
- No destination is inferred from names, IDs, codes, prefixes or position.
- A `Ref` source derives its storage type from the target PK.
- A non-`Ref` source type must exactly equal the target PK type.
- Inactive, absent, duplicate or keyless targets are errors.
- Self references and cycles are valid and resolved through indexes, without recursive traversal.

Alternative destination columns, composite relationships, cardinality, cascades and relationship metadata are outside AERP-038A.

## 7. Capability invariants

The model exposes column ID collections for visible, editable, required, searchable, filterable, sortable, indexed and virtual capabilities.

Contradictions are errors, including:

- required and nullable;
- virtual and editable;
- an inactive column exposing an active capability.

## 8. MetadataModel

```javascript
{
  contractVersion: "1.0.0",
  sourceSchemaVersion: string,
  tables: MetadataTable[]
}
```

Each `MetadataTable` contains normalized identity and descriptive fields, `classification`, `active`, `primaryKey`, optional `labelColumn`, resolved `foreignKeys`, normalized `columns` and capability ID collections.

The neutral model excludes AppSheet, SQL and API projections, service objects, execution timestamps, durations and UUID generation.

Ordering is deterministic:

1. tables by `physicalName`, then `id`;
2. columns by `Orden`, then `Nombre_Campo`, then `ID_Columna`;
3. FKs by source column name, then target physical name;
4. diagnostics by severity, code, path and message.

The output contains no `undefined`, functions, symbols, non-finite numbers, accessors or shared mutable references to input objects. It is fully JSON-serializable.

## 9. MetadataBuildSummary

The result summary is always recalculated and contains:

```text
tables, activeTables, inactiveTables,
columns, activeColumns, primaryKeys,
foreignKeys, labels, errors, warnings
```

All fields are non-negative integers.

## 10. Unknown properties and hostile structures

- Unknown object fields produce `MBE_UNKNOWN_FIELD`.
- Contract objects must have `Object.prototype` and data properties only.
- Arrays must use `Array.prototype`, be dense, and contain only indexed data properties plus `length`.
- Getters, setters, custom prototypes, sparse arrays and extra array properties are invalid.
- Proxy or reflection failures are sanitized as `MBE_INTERNAL_ERROR`.

## 11. Diagnostic catalog

| Code                                   | Severity | Blocking condition                            |
| -------------------------------------- | -------- | --------------------------------------------- |
| `MBE_INVALID_INPUT`                    | ERROR    | Invalid root or accessor-based consumed field |
| `MBE_UNKNOWN_FIELD`                    | ERROR    | Undeclared field                              |
| `MBE_INVALID_VERSION`                  | ERROR    | Missing/invalid source version                |
| `MBE_INVALID_GENERATED_AT`             | ERROR    | Missing/invalid generated date                |
| `MBE_INVALID_TABLES`                   | ERROR    | Invalid table array                           |
| `MBE_INVALID_SUMMARY`                  | ERROR    | Invalid summary object                        |
| `MBE_INVALID_SUMMARY_FIELD`            | ERROR    | Invalid summary member                        |
| `MBE_UPSTREAM_SCHEMA_ERROR`            | ERROR    | Upstream schema reports errors                |
| `MBE_SUMMARY_MISMATCH`                 | WARNING  | Recalculated counters differ                  |
| `MBE_NORMALIZED_LEGACY_ALIAS`          | WARNING  | Approved legacy type alias normalized         |
| `MBE_SAFE_DEFAULT_APPLIED`             | WARNING  | Optional capability receives `false`          |
| `MBE_MISSING_TABLE_ID`                 | ERROR    | Missing table ID                              |
| `MBE_MISSING_TABLE_CODE`               | ERROR    | Missing table code                            |
| `MBE_MISSING_PHYSICAL_NAME`            | ERROR    | Missing physical name                         |
| `MBE_INVALID_TABLE_FIELD`              | ERROR    | Invalid table field/object                    |
| `MBE_DUPLICATE_TABLE_ID`               | ERROR    | Duplicate table ID                            |
| `MBE_DUPLICATE_TABLE_CODE`             | ERROR    | Duplicate table code                          |
| `MBE_DUPLICATE_PHYSICAL_NAME`          | ERROR    | Duplicate physical name                       |
| `MBE_INVALID_BOOLEAN`                  | ERROR    | Non-boolean flag                              |
| `MBE_INVALID_COLUMNS`                  | ERROR    | Invalid column array                          |
| `MBE_ACTIVE_TABLE_WITHOUT_COLUMNS`     | ERROR    | Active table without active columns           |
| `MBE_MISSING_COLUMN_ID`                | ERROR    | Missing column ID                             |
| `MBE_MISSING_COLUMN_NAME`              | ERROR    | Missing column name                           |
| `MBE_INVALID_COLUMN_TABLE`             | ERROR    | Column/table ownership mismatch               |
| `MBE_INVALID_COLUMN_FIELD`             | ERROR    | Invalid column field/object                   |
| `MBE_DUPLICATE_COLUMN_ID`              | ERROR    | Duplicate global column ID                    |
| `MBE_DUPLICATE_COLUMN_NAME`            | ERROR    | Duplicate local column name                   |
| `MBE_INVALID_DATA_TYPE`                | ERROR    | Unsupported data type                         |
| `MBE_INVALID_COLUMN_ORDER`             | ERROR    | Invalid or duplicate order                    |
| `MBE_MISSING_PRIMARY_KEY`              | ERROR    | Active table has no explicit PK               |
| `MBE_MULTIPLE_PRIMARY_KEYS`            | ERROR    | Active table has multiple PKs                 |
| `MBE_INVALID_PRIMARY_KEY_TYPE`         | ERROR    | PK is not Text or Number                      |
| `MBE_NULLABLE_PRIMARY_KEY`             | ERROR    | PK permits null                               |
| `MBE_OPTIONAL_PRIMARY_KEY`             | ERROR    | PK is not required                            |
| `MBE_VIRTUAL_PRIMARY_KEY`              | ERROR    | PK is virtual                                 |
| `MBE_INACTIVE_PRIMARY_KEY`             | ERROR    | Inactive column declares PK                   |
| `MBE_PRIMARY_KEY_FOREIGN_KEY_CONFLICT` | ERROR    | Column is both PK and FK                      |
| `MBE_MULTIPLE_LABELS`                  | ERROR    | Active table has multiple labels              |
| `MBE_INVALID_LABEL_TYPE`               | ERROR    | Label is not scalar                           |
| `MBE_INACTIVE_LABEL`                   | ERROR    | Inactive column declares label                |
| `MBE_UNRESOLVABLE_FOREIGN_KEY`         | ERROR    | FK target empty, absent or ambiguous          |
| `MBE_INACTIVE_FOREIGN_KEY_TARGET`      | ERROR    | FK target inactive                            |
| `MBE_FOREIGN_KEY_TARGET_WITHOUT_PK`    | ERROR    | Target lacks valid PK                         |
| `MBE_INCOMPATIBLE_FOREIGN_KEY_TYPE`    | ERROR    | Storage types differ                          |
| `MBE_INACTIVE_FOREIGN_KEY`             | ERROR    | Inactive column declares FK                   |
| `MBE_REQUIRED_NULLABLE_CONFLICT`       | ERROR    | Required column permits null                  |
| `MBE_VIRTUAL_EDITABLE_CONFLICT`        | ERROR    | Virtual column is editable                    |
| `MBE_INACTIVE_CAPABILITY_CONFLICT`     | ERROR    | Inactive column exposes capability            |
| `MBE_INTERNAL_ERROR`                   | ERROR    | Sanitized unexpected exception                |

Public diagnostic messages are fixed by code. Diagnostics never contain original values, formulas, upstream error text, customer metadata, exception messages or stack traces.

## 12. Compatibility audit

`testMetadataBuilderEnterpriseCompatibilityAudit()` is an isolated Apps Script audit adapter. It obtains the current schema, invokes the pure API and returns only:

- `ok`;
- `contractVersion`;
- recalculated summary;
- diagnostic code, severity and contractual indexed path.

It does not write Sheets, activate a production wrapper or return complete metadata.

The audit is mandatory before activating the strict wrapper in an environment with legacy metadata. A successful audit does not replace the need to back up, migrate and verify incompatible metadata.

## 12.1 Production wrapper integration

AERP-038A Phase 2 includes the strict production wrapper in `14_MetadataBuilder.js`. The wrapper obtains `FrameworkSchema`, invokes the pure contract builder once per wrapper invocation, validates the strict result defensively and adapts it to the legacy shape required by the current consumers.

Platform-specific AppSheet, SQL and API projections and historical column classifications remain confined to this compatibility wrapper. They are not part of the neutral `MetadataModel` contract.

## 13. Versioning policy

The contract uses Semantic Versioning:

- PATCH: implementation corrections that do not change accepted input or public output semantics;
- MINOR: backward-compatible optional output additions or capabilities;
- MAJOR: required field, type, invariant, diagnostic-semantic or acceptance changes.

Consumers must reject unsupported major versions. Unknown input fields remain errors until introduced by a supported contract version.

## 14. AERP-038A limitations and subsequent scope

AERP-038A does not modify:

- Generator, AppSheet Generator or Build Pipeline consumers;
- DryRun integration;
- `CORE_RELACIONES` or `CORE_VISTAS`;
- composite PKs or relationships;
- alternative FK destination columns;
- bridge/view/system/business classification;
- cardinality, cascade or deployment behavior.

AERP-038B is reserved for consumer changes and for eliminating repeated metadata reconstruction between Generator, AppSheet Generator and Build Pipeline. Operational migration required to activate AERP-038A in an environment is governed by `MIGRATION-AERP-038A-MetadataModel-v1.0.0.md`; it is not deferred to AERP-038B.
