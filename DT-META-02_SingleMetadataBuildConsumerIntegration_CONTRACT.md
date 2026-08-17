# DT-META-02 — Single Metadata Build Consumer Integration

**Ticket:** AERP-038B Phase 1

**Status:** Implementation candidate

**Scope:** In-memory Generator and AppSheet consumer integration

## 1. Frozen objective

For each public AppSheet package entry:

1. MetadataModel is built and validated exactly once.
2. The same local MetadataModel reference is injected into Generator.
3. The resulting Generator object is injected into AppSheet Generator.
4. No stage reconstructs or rereads metadata.

Dependencies are passed through local variables. This contract prohibits caches, mutable singletons, `PropertiesService` and persistent or global build state.

## 2. Generator injectable API

```javascript
aerpBuildGeneratorEngineMVPFromMetadataModel(metadataModel);
```

The function accepts exactly one legacy MetadataModel produced by the strict AERP-038A wrapper. It never calls Metadata Builder and does not access Logger, clocks, UUID services, spreadsheets, properties or global version state.

Success:

```javascript
{
  ok: true,
  lineage: { algorithm: "SHA-256", version: "1.0.0", metadataFingerprint },
  application,
  tables,
  forms,
  views,
  menus,
  summary: {
    tables,
    forms,
    views,
    menus,
    errors: [],
    warnings: [],
    durationMs: 0
  },
  diagnostics: []
}
```

Invalid input:

```javascript
{
  ok: false,
  lineage: null,
  application: null,
  tables: [],
  forms: [],
  views: [],
  menus: [],
  summary: {
    tables: 0,
    forms: 0,
    views: 0,
    menus: 0,
    errors: ["El MetadataModel no es válido para Generator."],
    warnings: [],
    durationMs: 0
  },
  diagnostics: [{
    code: "GEN_METADATA_MODEL_INVALID",
    severity: "ERROR",
    stage: "GENERATOR",
    message: "El MetadataModel no es válido para Generator."
  }]
}
```

An unexpected exception uses `GEN_INTERNAL_ERROR` and the fixed message `No fue posible construir el resultado Generator.`.

Validation is defensive and covers the complete admitted legacy MetadataModel shape, including foreign keys, every capability list and the `appSheet`, `sql` and `api` projections. Fields that Generator does not project are still inspected for closed shape, safe descriptors, valid prototypes and contractual coherence. No sheet data is read and no PK, label or relationship is inferred.

## 3. Generator public wrapper

`aerpBuildGeneratorEngineMVP()` remains a no-argument public API. It:

1. invokes `aerpBuildMetadataModel()` once;
2. invokes the injectable Generator once with that same object;
3. performs no other metadata read;
4. adds legacy time and logging only to wrapper-owned copies.

`aerpGeneratorEngineToJSON()` and `testGeneratorEngineMVP()` remain public. The test requires `ok:true` and logs only a sanitized summary.

## 4. AppSheet injectable API

```javascript
aerpBuildAppSheetPackageFromGenerator(generatorResult);
```

The function accepts exactly one successful Generator result. It never calls Generator or Metadata Builder and does not access Logger, clocks, UUID services, Sheets, properties or global version state.

Success:

```javascript
{
  ok: true,
  lineage: { algorithm: "SHA-256", version: "1.0.0", metadataFingerprint },
  package,
  summary: {
    tables,
    columns,
    forms,
    views,
    menus,
    durationMs: 0
  },
  warnings: [],
  errors: [],
  diagnostics: []
}
```

Invalid Generator input uses `ASG_GENERATOR_RESULT_INVALID` and the fixed message `El resultado Generator no es válido para AppSheet.`.

An invalid constructed package uses `ASG_PACKAGE_INVALID` and the fixed message `El paquete AppSheet construido no es válido.`.

Unexpected exceptions use this result:

```javascript
{
  ok: false,
  lineage: null,
  package: null,
  summary: {
    tables: 0,
    columns: 0,
    forms: 0,
    views: 0,
    menus: 0,
    durationMs: 0
  },
  warnings: [],
  errors: ["No fue posible construir el paquete AppSheet."],
  diagnostics: [{
    code: "ASG_INTERNAL_ERROR",
    severity: "ERROR",
    stage: "APPSHEET_PACKAGE",
    message: "No fue posible construir el paquete AppSheet."
  }]
}
```

Unknown data types are errors. There is no fallback to `Text`. Existing initial-value rules remain a confined legacy AppSheet adaptation and are not extended by AERP-038B.

Before success, the complete constructed package is checked against the accepted Generator result. The check covers exact object shapes, all artifact counts, ordered columns, unique identities and the table links of forms, views and menus. A menu view must belong to the same table as the menu. Any incomplete helper result uses `ASG_PACKAGE_INVALID` and exposes no package.

## 5. AppSheet public wrapper

`aerpBuildAppSheetPackage()` remains the no-argument public package API. It composes:

```text
aerpBuildMetadataModel()                            once
  -> aerpBuildGeneratorEngineMVPFromMetadataModel() once
  -> aerpBuildAppSheetPackageFromGenerator()        once
```

It does not call `aerpBuildGeneratorEngineMVP()`. A Generator failure stops the AppSheet stage. Telemetry and sanitized logging exist only in wrapper-owned copies.

`aerpAppSheetPackageToJSON()`, `testAppSheetGeneratorMVP()` and `aerpValidateAppSheetPackage()` remain available. AERP-038B does not add `aerpBuildAppSheetPackageMVP()`.

## 6. Fail-closed and sanitization rules

- Ambiguous shapes, accessors, symbols, sparse arrays, duplicate identities, inconsistent counters and broken references are invalid.
- Generator failure exposes no application, tables, forms, views or menus.
- AppSheet failure exposes `package:null`.
- Construction completes in local variables before any result is returned.
- Both consumers validate their complete constructed result before returning `ok:true`; incomplete helper output cannot escape as a partial success.
- Input objects are never modified.
- Outputs share no mutable references with inputs.
- Diagnostics use only fixed code, severity, stage and message.
- Names, values, formulas, complete metadata, private exceptions and stack traces are never included in diagnostics or wrapper logs.

## 7. Compatibility

Successful Generator and AppSheet shapes retain all fields used by current consumers. Generator adds `ok`, `diagnostics` and the additive `lineage`; AppSheet adds the same additive `lineage`. Existing no-argument wrappers and manual test entrypoints remain callable.

Telemetry fields remain legacy wrapper concerns. Injectable APIs always return `durationMs:0` and do not consult a clock.

## 8. Phase 1 boundary

Phase 1 modifies only Generator and AppSheet Generator and adds their local contract and tests.

Pending for AERP-038B Phase 2:

- inject the same MetadataModel and Generator instances explicitly through Build Pipeline;
- remove nested public-wrapper calls from Pipeline;
- separate implicit metadata synchronization from Build Workflow;
- harden Deployment and Workflow effect boundaries;
- prove that no package or deployment writer receives a partial result.

Phase 1 does not design AppSheet slices, actions or automations and does not introduce cache or persistent state.

## 9. Approved AERP-038B Phase 2 architecture

The approved operational direction is:

- `Generar ERP` never rebuilds or overwrites `CORE_COLUMNAS`.
- Metadata synchronization remains a separate explicit action.
- Pipeline becomes the only operational orchestrator in Phase 2B.
- `12_DryRun.js` is the canonical public owner of `runAlefERPDryRun()`.
- The duplicate global declaration in `10_Main.js` is resolved in Phase 2B.
- Workflow stops rebuilding `CORE_COLUMNAS` in Phase 2B.
- The future `aerpRunBuildWorkflow().metadata` field is a sanitized summary of the MetadataModel actually consumed.

Phase 2 is split deliberately:

- Phase 2A adds and proves the pure in-memory path without connecting effects.
- Phase 2B connects Pipeline, Deployment and Workflow and resolves the legacy DryRun collision.

## 10. Pure FrameworkSchema consumer

```javascript
aerpBuildMetadataModelFromFrameworkSchema(frameworkSchema);
```

This API receives one prebuilt FrameworkSchema, invokes the strict builder exactly once, validates the strict result and creates the approved legacy MetadataModel adaptation. It does not call `aerpBuildFrameworkSchema()` and does not access Sheets, Logger, a clock, UUID services, locks, properties or mutable global build state.

Its successful output retains the public MetadataModel shape, with pure telemetry values:

```javascript
{
  version,
  generatedAt: null,
  tables,
  summary: {
    ok: true,
    contractVersion: "1.0.0",
    tables,
    columns,
    primaryKeys,
    foreignKeys,
    labels,
    warnings,
    errors: [],
    diagnostics,
    durationMs: 0
  }
}
```

Failure uses the existing sanitized `MBE_INTERNAL_ERROR` legacy failure and returns no tables. The public no-argument `aerpBuildMetadataModel()` remains compatible: it constructs FrameworkSchema once, calls this API once and adds wrapper-owned time values.

## 11. Pure single-build bundle

```javascript
aerpBuildSingleMetadataArtifactsFromFrameworkSchema(frameworkSchema);
```

The API executes exactly this sequence:

```text
aerpBuildMetadataModelFromFrameworkSchema()       once
  -> aerpBuildGeneratorEngineMVPFromMetadataModel() once
  -> aerpBuildAppSheetPackageFromGenerator()        once
  -> aerpValidateSingleBuildArtifacts()              once
```

It never invokes the public MetadataModel, Generator or AppSheet wrappers. It does not accept production callbacks or service objects.

Success:

```javascript
{
  ok: true,
  lineage: { algorithm: "SHA-256", version: "1.0.0", metadataFingerprint },
  metadataModel,
  generatorResult,
  appSheetResult,
  summary: {
    contractVersion: "1.0.0",
    tables,
    columns,
    primaryKeys,
    foreignKeys,
    labels,
    forms,
    views,
    menus
  },
  diagnostics: []
}
```

Each local stage receives the exact object returned by the immediately preceding local stage. After validation, the public bundle is returned as an independent deep copy and is deeply frozen. No returned artifact shares a mutable reference with FrameworkSchema, a stage-local artifact or its predecessor.

Failure:

```javascript
{
  ok: false,
  lineage: null,
  metadataModel: null,
  generatorResult: null,
  appSheetResult: null,
  summary: {
    contractVersion: "1.0.0",
    tables: 0,
    columns: 0,
    primaryKeys: 0,
    foreignKeys: 0,
    labels: 0,
    forms: 0,
    views: 0,
    menus: 0
  },
  diagnostics: [{ code, severity: "ERROR", stage: "SINGLE_BUILD", message }]
}
```

Approved failure codes are `SB_METADATA_MODEL_FAILED`, `SB_GENERATOR_FAILED`, `SB_APPSHEET_FAILED`, `SB_VALIDATION_FAILED` and `SB_INTERNAL_ERROR`. Messages are fixed. Failure at one stage prevents every later stage and removes every partial artifact. Success and failure bundles are deeply frozen.

### 11.1 Deterministic lineage

Lineage is computed internally from the complete validated MetadataModel using a pure JavaScript SHA-256 implementation. Canonicalization uses ordinal key ordering and rejects accessors, Symbols, sparse or extended arrays, altered prototypes, non-plain objects, unsupported values and cycles. It excludes only non-contractual telemetry: root `generatedAt` and `summary.durationMs`.

The lineage object has the closed shape `{ algorithm: "SHA-256", version: "1.0.0", metadataFingerprint }`. Generator derives it from its MetadataModel input; AppSheet propagates the structurally valid Generator lineage because it does not receive MetadataModel; and the bundle recalculates lineage independently from MetadataModel as the final trust boundary. The bundle never accepts a caller-provided fingerprint as proof by itself: MetadataModel, Generator, AppSheet and bundle fingerprints must match exactly in addition to complete cross-artifact validation. Artifacts from distinct validated builds with different MetadataModels therefore cannot be combined.

Dos MetadataModel canónicamente idénticos son equivalentes para lineage y deben producir exactamente el mismo `metadataFingerprint`. Las diferencias en cualquier campo contractual no excluido deben producir una representación canónica diferente y, salvo una colisión criptográfica de SHA-256, un fingerprint diferente.

## 12. Pure artifact validation

```javascript
aerpValidateSingleBuildArtifacts(artifacts);
```

This API validates the complete closed bundle and the cross-artifact relationship. It delegates only to the already approved pure defensive validators; it does not rebuild any artifact.

It verifies:

- closed shapes, safe descriptors and standard prototypes;
- dense arrays without Symbols or extra properties;
- MetadataModel, Generator and AppSheet internal validity;
- version equality across all three artifacts;
- exact counts for tables, columns, keys, foreign keys, labels, forms, views and menus;
- exact Generator-to-Metadata and AppSheet-to-Generator projections.
- SHA-256 lineage recalculated from MetadataModel and exact fingerprint equality across the bundle, Generator and AppSheet.

It never executes accessors and returns only a sanitized validation result:

```javascript
{
  ok,
  summary: {
    contractVersion: "1.0.0",
    tables,
    columns,
    primaryKeys,
    foreignKeys,
    labels,
    forms,
    views,
    menus
  },
  diagnostics
}
```

Failure uses `SBV_ARTIFACTS_INVALID`, `lineage:null`, all three artifact fields set to `null`, zero counts and no business identifiers or artifacts. The validator verifies the AppSheet result shape before accessing its nested package, so hostile nested accessors are not executed.

This API is distinct from physical `runAlefERPDryRun()`. The physical DryRun continues to inspect Sheets and compare scanned metadata with `CORE_COLUMNAS`; it is never called by the in-memory bundle.

## 13. Phase 2A effect boundary

Phase 2A does not connect `aerpRunBuildPipeline()` to the bundle. The current operational calls, monitoring and writes remain unchanged until Phase 2B.

The pure APIs prohibit:

- Spreadsheet reads or writes;
- monitor creation;
- deployment;
- physical DryRun or metadata synchronization;
- Logger, current timestamps, UUID generation, locks and properties;
- caches, singletons and hidden persistent state.

Phase 2B will connect the validated bundle to Pipeline, make Pipeline the single operational orchestrator, adapt Deployment and Workflow, remove Workflow metadata rebuild and resolve the duplicate `runAlefERPDryRun()` declaration. No Phase 2A API writes `CORE_COLUMNAS` or any operational sheet.
