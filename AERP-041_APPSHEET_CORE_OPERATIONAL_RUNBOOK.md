# AERP-041 — Operational AppSheet Core Installation Runbook

## Purpose

This runbook activates the approved AERP-041 isolated installation without AppSheet Enterprise. It coordinates the secure OIDC bootstrap, the 17-table AERP-040 commercial blueprint, the manual AppSheet Core acceptance checklist and the final fail-closed verification.

The workflow does not change AERP-036/AERP-037 authorization. Menu visibility, navigation and AppSheet presentation never grant access.

## Preconditions

- The Apps Script project is bound to a new, isolated Google Sheets copy.
- The bound spreadsheet is not the source/template spreadsheet.
- The operator is a script editor and the intended initial Alef ERP administrator.
- The initial administrator e-mail has been approved before configuration and matches the verified Google OIDC e-mail exactly.
- The OAuth scopes `openid` and `https://www.googleapis.com/auth/userinfo.email` are approved.
- The AERP-040 blueprint and presentation manifest are the versioned release artifacts.
- No customer data is copied into the isolated target before installation.

## Script properties

Create `AERP041_OPERATIONAL_CONFIG` as a JSON Script Property. Do not add extra keys.

```json
{
  "sourceId": "SOURCE_SPREADSHEET_ID",
  "tenantId": "TENANT_IDENTIFIER",
  "expectedAudience": "APPS_SCRIPT_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "expectedAdminEmail": "admin@your-domain.example",
  "company": {
    "code": "TENANT_CODE",
    "name": "COMPANY_DISPLAY_NAME",
    "currency": "USD",
    "timeZone": "Europe/Madrid"
  }
}
```

Rules:

- `targetId` is never configured. The controller derives it from the active bound spreadsheet.
- `sourceId`, `targetId` and `tenantId` must be distinct/bound exactly as required.
- `expectedAdminEmail` is mandatory and is compared case-insensitively with the verified e-mail from the OIDC token. A different principal cannot issue or renew installation evidence.
- Do not store OIDC tokens, confirmation IDs, nonces or passwords in Script Properties.
- Company values are installation input, not authorization metadata.

## Phase 1 — Install the isolated structure

1. Open the isolated bound spreadsheet.
2. Select **Alef ERP → Instalación segura**.
3. Review the displayed state and pending operation count.
4. Confirm explicitly.

The controller obtains OIDC identity directly through `ScriptApp.getIdentityToken()`, creates a short-lived plan-bound confirmation and immediately invokes the secure installer. The raw nonce is never persisted by the controller.

Expected result before AppSheet is configured:

- 17 versioned tables exist with exact headers;
- AERP-040 blueprint and presentation resources exist;
- explicit initial administrative metadata exists;
- installation state is `INCOMPLETE`;
- normal ERP access remains denied until all checks pass.

## Phase 2 — Configure and test AppSheet Core

Create or bind the approved AppSheet Core application to the isolated spreadsheet, then verify every item below:

1. Sign-in is required.
2. Google is the authentication provider.
3. “Allow all signed-in users” is disabled.
4. Users are explicitly allowlisted.
5. Every one of the 17 tables has the approved tenant/security filter and update policy.
6. Updates are restricted by role.
7. AppSheet Deployment Check passes.
8. The explicit administrator allow test passes.
9. The restricted-user deny test passes.
10. The cross-tenant deny test passes.
11. AppSheet audit/history evidence is reviewed.

Do not mark a check `true` without evidence. The absence of a failed test is not approval.

## AppSheet attestation input

Create `AERP041_APPSHEET_ATTESTATION_INPUT` as a JSON Script Property only after all checks pass. Do not add extra keys.

```json
{
  "appId": "APPSHEET_APP_ID",
  "appVersion": 1,
  "templateVersion": "1.0.0",
  "deploymentCheckReference": "DEPLOYMENT_CHECK_REFERENCE",
  "evidenceDigest": "64_CHARACTER_LOWERCASE_SHA256",
  "checks": {
    "requireSignIn": true,
    "googleAuthenticationProvider": true,
    "allowAllSignedInUsersDisabled": true,
    "explicitUserAllowlist": true,
    "updatesRestrictedByRole": true,
    "deploymentCheckPassed": true,
    "adminAllowTestPassed": true,
    "restrictedUserDenyTestPassed": true,
    "crossTenantDenyTestPassed": true,
    "auditHistoryReviewed": true
  },
  "tableChecks": [
    {
      "physicalName": "CORE_EMPRESAS",
      "securityFilterVerified": true,
      "updatePolicyVerified": true,
      "adminAllowTestPassed": true,
      "restrictedUserDenyTestPassed": true,
      "crossTenantDenyTestPassed": true,
      "evidenceReference": "CORE_EMPRESAS_CHECK_REFERENCE",
      "evidenceDigest": "64_CHARACTER_LOWERCASE_SHA256"
    }
  ]
}
```

The example shows the schema of one `tableChecks` entry. The property is accepted only when it contains exactly one entry for each of these 17 physical tables, without duplicates or omissions:

`CORE_EMPRESAS`, `CORE_USUARIOS`, `CORE_ROLES`, `CORE_MODULOS`, `CORE_USUARIO_ROL`, `CORE_ROL_MODULO`, `CORE_PERMISOS`, `CORE_CONFIGURACION`, `ERP_CLIENTES`, `ERP_PROVEEDORES`, `ERP_PRODUCTOS`, `ERP_INVENTARIO`, `ERP_MOVIMIENTOS_INVENTARIO`, `ERP_PEDIDOS`, `ERP_PEDIDO_DETALLE`, `ERP_VENTAS`, `ERP_VENTA_DETALLE`.

The root `evidenceDigest` identifies the controlled acceptance package. Every table entry also carries its own evidence reference and SHA-256 digest. These values link the attestation to retained evidence; they are not authorization credentials.

The persisted attestation includes a deterministic digest over every stored field. Any uncoordinated change to application identifiers, version, timestamp, reviewer, global checks or per-table evidence makes readiness fail closed. This is tamper-evident within the Apps Script trust boundary; it is not an external digital signature against a malicious script editor who can replace code and properties together.

## Phase 3 — Complete and verify

1. Select **Alef ERP → Completar AppSheet Core**.
2. Verify the AppSheet identifiers shown in the confirmation dialog.
3. Confirm explicitly.
4. Select **Alef ERP → Estado instalación segura**.

The completion action:

- records a document-scoped, administrator-authorized attestation;
- validates exactly 17 table-specific security and deny-test evidence rows;
- renews confirmation only for the same claimed OIDC principal, tenant, target, plan and configuration;
- immediately reapplies verification;
- consumes the one-time bootstrap only after state becomes `COMPLETE`.

Expected final status:

- `state: COMPLETE`;
- `appSheetReady: true`;
- `verified: true`;
- `persistence: CONFIRMED` or `UNCHANGED` for a no-op repeat.

## Fail-closed behavior

Stop and investigate if any of these appears:

- `OPERATIONAL_PREVIEW_REJECTED`: configuration, binding or plan validation failed.
- `OPERATIONAL_TARGET_INCOMPATIBLE`: target content differs from the approved blueprint.
- `OPERATIONAL_INSTALLATION_INCOMPLETE`: structure or security validation is still pending.
- `OPERATIONAL_ATTESTATION_REJECTED`: the checklist, administrator authorization or stored evidence is invalid.
- `persistence: UNKNOWN`: a storage response was ambiguous. Do not assume success; inspect status and retry only through the same menu workflow.

Never replace a DENY with manual spreadsheet edits. Never copy confirmation evidence between spreadsheets or tenants. Never use the legacy **Generar ERP** command as an authorization bypass.

## Operational boundary

This runbook covers AppSheet Core manual validation. It does not provide AppSheet Enterprise API validation, deploy automatically, publish a branch, or authorize writes to a production/customer spreadsheet. Those actions require separate approval.
