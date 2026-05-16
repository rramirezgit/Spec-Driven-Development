<!-- sdd-version: 1.0 -->
# Role
Testing engineer enfocado en smoke tests **inmediatamente después de la
implementación**, antes de evidencia. Reusa el clasificador de `/update-docs`
para saber QUÉ testear y el cache de diff de V4.17 para no re-correr `git diff`.

> **Filosofía**: conservador. Lo que el smoke test verifica NO es que el feature
> sea correcto — verifica que la superficie técnica responde como se espera
> (status code, shape de response, render sin console errors). La corrección
> semántica sigue siendo del humano. El gate humano de IMPLEMENTACION → EVIDENCIA
> **no desaparece** — el auto-verify lo enriquece, no lo reemplaza.

# Cuándo se invoca

Después de `/develop-*` y antes de `sdd_confirm_implementation`, **solo si**
`project-profile.md` tiene `Auto Verify Enabled: true`.

Si está deshabilitado → este comando no se invoca; comportamiento V4.19 intacto.

# Arguments

`$ARGUMENTS` — opcional. Sin args usa el ticket activo del state.
- `--skip "<razón>"` → registrar `skipped` directamente con razón explícita (≥10 chars).
- `--inconclusive "<razón>"` → registrar `inconclusive` (ej. cuando el user
  sabe que el dev server no va a estar disponible).

# Process

## 0. Cargar contexto

```
sdd_get_state()
```

Del response, obtener:
- `activeTicket` — ID
- `featureBranch`
- `targetSubproject` (si multi-target)
- Y de `loadProjectConfig`: `autoVerify.devPort`, `autoVerify.healthEndpoint`, `autoVerify.enforced`

## 1. Cache + classify del diff

```
sdd_cache_diff()
```

Leer el archivo cacheado en `.ai-internal/.cache/diff-{TICKET}.txt`.

**Reusar la tabla de triggers de `/update-docs` §2** para identificar qué se
puede smoke-testear:

| Trigger | Tipo de smoke | Cómo |
|---------|---------------|------|
| **T1 — Endpoint público nuevo/modificado** | HTTP request al endpoint | curl con payload mínimo del schema, validar status 2xx + shape |
| **T2 — Breaking change API** | Mismo que T1 + validar campos nuevos/removidos | curl + jq sobre response |
| **T7 — Nueva ruta de usuario** | (V4.21 con Chrome DevTools) HTTP HEAD al path | curl -I — no full render todavía |
| **T8 — Migración DB** | NO testear automáticamente | Reportar como inconclusive con guía |

Los demás triggers (T3 env var, T4 CLI, T5 deploy, T6 webhook) **NO disparan
smoke test** porque requieren contexto humano para verificar correctamente.

## 2. Verificar capacidad de testing

```bash
# Ping al dev server (si HTTP triggers)
DEV_PORT="${SDD_AUTO_VERIFY_DEV_PORT:-3000}"
curl -sS -o /dev/null -w "%{http_code}" "http://localhost:${DEV_PORT}${SDD_AUTO_VERIFY_HEALTH_ENDPOINT:-/}" --max-time 3 2>/dev/null
```

- Si retorna código 2xx/3xx/4xx (el server respondió) → server up, continuar.
- Si timeout o curl falla → server down.

**Si el server está down y hay triggers HTTP**:

```
sdd_register_auto_verification({
  status: "inconclusive",
  reason: "Dev server no respondió en :{PORT}",
  cases: [],
  blockers: ["Arrancar dev server (npm run dev / similar) y re-ejecutar /auto-verify"]
})
```

Mostrar al usuario:
```
⚠️ Auto-verify INCONCLUSIVE
   El dev server no respondió en localhost:{PORT}.
   
   Para testear:
     1. Arrancá el dev server: npm run dev (o tu comando)
     2. Volvé a correr este flow
   
   Si querés saltar auto-verify para este ticket:
     /auto-verify --skip "<razón>"
```

NO bloquear — `inconclusive` permite avanzar (degrade gracefully). El user
decide si arrancar el server o seguir sin smoke.

## 3. Generar casos de prueba (solo triggers HTTP)

Para cada T1/T2 detectado en el diff:

1. Identificar el endpoint desde el archivo del diff (path + método).
2. Inferir el payload mínimo desde el DTO/schema del controller.
3. Generar el caso:
   - `Method PATH` con payload mínimo válido → esperar 2xx
   - Si el endpoint requiere auth y no hay token en `.env.test` → caso `inconclusive`

## 4. Ejecutar los casos

```bash
# Ejemplo para T1: POST /sessions
curl -sS -X POST "http://localhost:${PORT}/sessions" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  -w "\n%{http_code}" \
  --max-time 5 2>&1
```

Para CADA caso:
- Parsear status code y primera línea del body.
- Decidir outcome:
  - 2xx + body parseable → `passed`
  - 4xx (esperado para validación) → `passed` si el ticket testea ese caso
  - 5xx → `failed` con detail del error
  - timeout / connection refused → `inconclusive` con razón

## 5. Validación de no-prod

**ANTES de cualquier curl, validar URL**:
- Si `host` no es `localhost` ni `127.0.0.1` ni `::1` → **ABORT**.
- Registrar `inconclusive` con razón "URL no es localhost — auto-verify abortado por seguridad".
- Mostrar al user un error explícito.

## 6. Reportar al usuario antes de registrar

Mostrar dashboard:

```
🧪 Auto-verify completado

Smoke tests:
  ✅ POST /sessions → 201 Created (~120ms)
  ✅ GET /users/me  → 200 OK (~80ms)
  ⚠️ POST /users    → 401 Unauthorized (esperaba 201; falta token en .env.test?)

Triggers no testeados (requieren verificación humana):
  • T3 env var SESSION_SECRET — chequeá que la value en producción esté seteada
  • T8 migración 20260516_sessions — corré la migration en staging antes del deploy

Status global: failed
Razón: POST /users falló auth en smoke test
Blockers:
  • Agregar TEST_AUTH_TOKEN al .env.test para que el smoke testee el endpoint protegido
```

## 7. Registrar el resultado

```
sdd_register_auto_verification({
  status: "passed" | "failed" | "inconclusive" | "skipped",
  reason: "<razón global concreta>",
  cases: [
    { trigger: "T1", description: "POST /sessions con payload válido", outcome: "passed", detail: "201 Created" },
    ...
  ],
  blockers: [
    "Agregar TEST_AUTH_TOKEN al .env.test",
    ...
  ]
})
```

## 8. Si `autoVerify.enforced=true` y `status=failed`

El MCP rechazará `sdd_advance(EVIDENCIA)` hasta que se resuelvan los blockers.
Guiar al user:

```
⛔ Auto-verify falló y está enforced.
Para avanzar a evidencia:
  1. Resolvé los blockers de arriba.
  2. Re-ejecutá /auto-verify hasta que status sea passed o inconclusive.
  3. Si los smokes no son posibles (ej. el ticket no tiene endpoint testeable),
     /auto-verify --skip "<razón ≥10 chars>" para registrar skipped.
```

## 9. Atajos

- `/auto-verify --skip "razón"` → registra skipped directamente.
- `/auto-verify --inconclusive "razón"` → registra inconclusive.
- `/auto-verify` (sin args) → flow completo.

# Protecciones

- **Nunca correr contra prod ni staging**: validar host en cada request, abortar si no es localhost.
- **Nunca arrancar el dev server**: solo ping. Si no responde → inconclusive.
- **Nunca usar credentials reales**: si requiere auth, leer de `.env.test` (no de `.env`/`.env.production`).
- **Nunca usar credentials hardcoded en el código del comando**: leer del filesystem.
- **Nunca testear endpoints que afecten datos reales sin sandbox** (ej. webhook a Stripe LIVE): si detectás URL con `live` o `production` en el path o env → skip con razón.
- **Buffer de output corto**: status code + 1ra línea del body. NO volcar bodies completos al chat — desperdicia tokens.

# Diferencia con tests del proyecto

`/auto-verify` NO reemplaza los tests del proyecto (Vitest/Playwright/etc).
Es un smoke layer **adicional** que verifica que el endpoint responde y la
ruta carga. Si el proyecto tiene tests E2E, corrlos por separado vía
`npm test` después de auto-verify.

# Resumen del comportamiento

1. Si `Auto Verify Enabled: false` → este comando no existe operativamente.
2. Si dev server down → `inconclusive` con guía para arrancar.
3. Si triggers HTTP → smoke con curl, validar localhost-only.
4. Si todos pasan → `passed`. El gate humano sigue (`sdd_confirm_implementation`).
5. Si alguno falla → `failed`. Bloquea EVIDENCIA si `enforced=true`.
6. Sin triggers testeables → `skipped` con razón ("solo refactor interno", etc.).
