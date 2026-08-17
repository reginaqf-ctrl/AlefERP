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

Successful Generator and AppSheet shapes retain all fields used by current consumers. Generator adds `ok` and `diagnostics`. Existing no-argument wrappers and manual test entrypoints remain callable.

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
