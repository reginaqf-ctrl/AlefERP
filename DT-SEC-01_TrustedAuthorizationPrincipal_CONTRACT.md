# DT-SEC-01 · TrustedAuthorizationPrincipal

## Estado

Contrato proveedor-independiente aprobado para implementación en AERP-037.

## Objetivo

Impedir que un cliente elija o suplante la identidad utilizada por el sistema de autorización. La identidad efectiva siempre debe proceder de evidencia autenticada y verificada por el backend.

## Frontera de confianza

- `request`, `request.userId`, `request.context` y todos los datos procedentes del navegador son no confiables.
- `options.trustedPrincipalVerifier` es una dependencia interna del backend. No puede obtenerse del cuerpo del request ni ser seleccionada por el cliente.
- El verificador es responsable de validar la sesión o token con el proveedor de identidad elegido.
- AERP-037 solo acepta un principal cuando el verificador devuelve explícitamente `ok: true` y `verified: true`.

## Entrada del verificador

```javascript
{
  authentication: request.authentication,
  requestedCompanyId: normalizedCompanyId
}
```

`authentication` es opaco para AERP-037. Su formato será definido por el adaptador del proveedor futuro.

## Salida válida del verificador

```javascript
{
  ok: true,
  verified: true,
  principal: {
    issuer: 'https://identity-provider.example',
    subjectId: 'stable-provider-subject',
    userId: 'AERP_INTERNAL_USER_ID',
    authenticationMethod: 'OIDC'
  },
  errors: []
}
```

## Invariantes obligatorios

1. `issuer`, `subjectId` y `userId` son obligatorios y no vacíos.
2. `subjectId` es el identificador estable emitido por el proveedor; el email no sustituye este identificador.
3. `userId` es el identificador interno obtenido mediante el mapeo confiable `(issuer, subjectId) → userId`.
4. `request.userId` nunca participa en la resolución del sujeto efectivo.
5. Sin verificador, evidencia inválida, principal incompleto, excepción o mapeo inexistente, el resultado es `DENY`.
6. Autenticación y autorización son controles separados: un principal válido todavía debe superar el aislamiento por `companyId` y las reglas de permisos.
7. El verificador futuro debe validar firma o sesión, issuer, audience, expiración y los controles adicionales aplicables al mecanismo seleccionado.
8. Los tokens, cookies o secretos de autenticación no deben copiarse al principal, contexto, trace, logs ni respuesta pública.
9. El verificador se configura en código confiable del backend. Nunca se acepta una función, nombre de verificador o configuración equivalente desde el cliente.

## Estados fail-closed

- `TRUSTED_PRINCIPAL_VERIFIER_NOT_CONFIGURED`
- `TRUSTED_PRINCIPAL_VERIFICATION_FAILED`
- `UNAUTHENTICATED` o estado seguro equivalente devuelto por el adaptador
- `INVALID_TRUSTED_PRINCIPAL`

Todos producen `ok: false`, `decision: 'DENY'` y `allowed: false` en la API integrada de autorización.

## Integración futura

Al seleccionar el proveedor se implementará un adaptador que cumpla este contrato. Para OpenID Connect deberá validar el token o sesión con una biblioteca apropiada y mapear `issuer + sub` al usuario interno. La lógica de AERP-037 no dependerá del proveedor concreto.

## Fuera de alcance

- Selección y configuración del proveedor de identidad.
- Flujo de login, logout, recuperación y MFA.
- Persistencia de sesiones y rotación de cookies/tokens.
- Implementación criptográfica de JWT/OIDC.
- Autorización por tenant, cubierta separadamente por DT-SEC-02.
