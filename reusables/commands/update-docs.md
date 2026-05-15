<!-- sdd-version: 1.0 -->
# Role
Documentation engineer. Decide si el cambio del ticket activo amerita actualizar el
site de Docusaurus, y si amerita, escribe el doc mínimo necesario. **CONSERVADOR
POR DEFECTO**: la respuesta correcta para la mayoría de tickets es `skipped`.

> **Regla de oro**: mejor un falso negativo (el dev documenta a mano si hace falta)
> que un falso positivo (entradas vacías, triviales o redundantes en el site). Si
> el ticket no tiene un trigger claro de la tabla §2, NO documentes — registrá
> `skipped` con razón específica y seguí adelante.

# Cuándo se invoca

Automáticamente entre EVIDENCIA y COMMIT, **solo cuando Docusaurus está habilitado**
en el proyecto (`Docusaurus Enabled: true` en `project-profile.md`). El MCP server
bloquea `sdd_advance(COMMIT)` hasta que se llame `sdd_register_docs_decision`.

Si Docusaurus NO está habilitado → este comando no se invoca. Cero overhead.

# Arguments
`$ARGUMENTS` — opcional. Sin argumentos toma el ticket activo del state. Con `--force-skip "<razón>"` registra skip directamente sin clasificar (útil cuando el dev ya sabe que no aplica).

# Process

## 0. Recolectar contexto del ticket

```bash
# Ticket activo, branch, target subproject (multi-target), config Docusaurus
# se obtienen del MCP via sdd_get_state.
git diff $(git merge-base main HEAD)...HEAD --name-only
git diff $(git merge-base main HEAD)...HEAD --stat
git diff $(git merge-base main HEAD)...HEAD -- '*.env.example' '*.env.template'
```

Variables que necesitás del state (vía `sdd_get_state`):
- `activeTicket` — ID del ticket
- `featureBranch` — nombre de la rama
- `targetSubproject` — slug (solo si multi-target)

Variables que necesitás del config (vía `loadProjectConfig` o leyendo `.ai-internal/project-vars.sh`):
- `SDD_DOCUSAURUS_ROOT` — ej. `apps/docs`
- `SDD_DOCUSAURUS_DOCS_PATH` — ej. `docs`
- `SDD_MULTI_TARGET_MODE` — `true|false`
- `SDD_SUBPROJECT_SLUGS` — lista separada por comas (si multi-target)

> **Si no podés resolver `SDD_DOCUSAURUS_ROOT`**: registrar `skipped` con razón
> "config Docusaurus inválida" y abortar. NO intentes escribir docs sin path
> confirmado.

## 1. Atajo `--force-skip`

Si el usuario pasó `--force-skip "<razón>"` → llamar directamente
`sdd_register_docs_decision({status: "skipped", reason: "<razón>", files: []})` y terminar.
La razón debe tener al menos 10 caracteres significativos. Si es vaga ("no aplica",
"nada importante"), rechazar y pedir una razón concreta.

## 2. Aplicar la tabla de triggers (clasificador conservador)

Leer el diff y evaluar **cada trigger**. Un ticket puede disparar más de uno.
Si NINGUNO dispara → skip.

| # | Trigger | Señal en el diff | Sección destino |
|---|---------|------------------|-----------------|
| T1 | **Endpoint público nuevo o modificado** | Archivo nuevo (o modificado con cambio de signature) en paths tipo `**/controllers/**`, `**/routes/**`, `**/handlers/**`, `**/api/**`, `**/resolvers/**` que contenga decoradores HTTP (`@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`) o `router.{get,post,put,patch,delete}` o equivalente del framework. Excluir si el path contiene `/internal/`, `/private/`, `__tests__`. | `api.md` del subproject |
| T2 | **Breaking change en API** | Diff que MODIFICA un DTO / schema de response existente, cambia query/body params, agrega/quita campos required, cambia status codes documentados. Detección: en archivos del Trigger T1, líneas removidas (`-`) que tocan campos públicos. | `api.md` + nota de breaking |
| T3 | **Variable de entorno nueva** | Líneas agregadas en `.env.example` / `.env.template` / `.env.local.example` (regex `^\+[A-Z_]+=`). Solo cuenta como trigger si la key NO empezaba en el archivo original. | `processes/env-vars.md` |
| T4 | **CLI / script nuevo** | Nuevo script en `package.json` (sección `scripts`), nuevo archivo en `bin/`, `scripts/`, o nuevo target deployable. NO triggerea: scripts de test, build, lint, format. | `processes/cli.md` |
| T5 | **Cambio de deploy / CI** | Diff en `.github/workflows/`, `Dockerfile`, `docker-compose*.yml`, `k8s/`, `helm/`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`. Excluir si es solo bump de versión de imagen sin cambio de comportamiento. | `processes/deployment.md` |
| T6 | **Webhook entrante o evento emitido nuevo** | Archivo nuevo con handler de webhook (`/webhooks/`, `WebhookController`), o nuevo `emit`/`publish` a un bus de eventos público (no eventos internos de UI). | `integrations.md` del subproject |
| T7 | **Nueva ruta de usuario / flow** | Archivo nuevo en `**/app/**/page.{ts,tsx,vue,svelte}`, `**/pages/**`, o nueva entrada en un router central con `path:` que NO sea admin/debug. Solo cuenta si el componente exporta default y tiene contenido (no placeholder). | `frontend/flows/{slug}.md` |
| T8 | **Migración de DB** | Nuevo archivo en `prisma/migrations/`, `migrations/`, `db/migrate/`, o cambio en `schema.prisma` / `models/`. | `architecture/data-model.md` |

### Anti-triggers (NUNCA documentan, aunque haya señal aparente)

- Cambios SOLO en archivos de test (`*.test.*`, `*.spec.*`, `__tests__/`, `e2e/`).
- Cambios SOLO en config de lint/format (`.eslintrc*`, `.prettierrc*`, `biome.json`).
- Bumps de dependencias en `package.json`/`package-lock.json` sin otros cambios.
- Renames puros (mismo contenido, distinto nombre).
- Cambios en comentarios o documentación interna (`/* */`, `//`, jsdoc) sin cambio de código.
- Refactor con superficie pública idéntica: misma signature, mismas rutas, mismos schemas.
- Archivos generados (con header `// AUTO-GENERATED` o equivalente).
- Cambios en `.gitignore`, `.editorconfig`, `.nvmrc`, `tsconfig.*` (a menos que cambien paths públicos).

### Reglas de combinación

- Si dispara **solo T3 o solo T4** (env var nueva o script) → es trigger válido pero **doc liviana** (1-3 líneas). No invente contexto que el diff no provee.
- Si dispara **T1 + T2** → un solo doc, en `api.md`, marcando explícitamente el breaking.
- Si dispara **5+ triggers** distintos → algo huele raw. **Re-evaluá**: probablemente el ticket es demasiado grande y debería haberse partido. Registrá la decisión pero advertí al usuario.

## 3. Resolver paths de destino

```
BASE = {SDD_DOCUSAURUS_ROOT}/{SDD_DOCUSAURUS_DOCS_PATH}

Si SDD_MULTI_TARGET_MODE == true Y targetSubproject está seteado:
  SCOPE = "{BASE}/services/{targetSubproject}/"
  api.md             → {SCOPE}/api.md
  integrations.md    → {SCOPE}/integrations.md
  processes/{X}.md   → {SCOPE}/processes/{X}.md   # env-vars, cli, deployment
  flows/{slug}.md    → {BASE}/frontend/flows/{slug}.md     # frontend es global
  data-model.md      → {BASE}/architecture/data-model.md   # arquitectura es shared
Si modo simple (no multi-target):
  api.md             → {BASE}/api.md
  integrations.md    → {BASE}/integrations.md
  processes/{X}.md   → {BASE}/processes/{X}.md
  flows/{slug}.md    → {BASE}/frontend/flows/{slug}.md
  data-model.md      → {BASE}/architecture/data-model.md
```

**Si el archivo destino no existe** → crearlo con un H1 mínimo derivado del nombre
(ej: `# API`, `# Procesos / Variables de entorno`). Una línea de descripción.
**No agregues TOC, badges, ni boilerplate.**

**Si el archivo destino existe** → leerlo, identificar la sección apropiada
(por header), y agregar al final de esa sección. Si la sección no existe, agregarla
al final del archivo bajo un `## ` apropiado.

## 4. Generar contenido (mínimo necesario)

Por cada trigger disparado, escribir el bloque más corto y específico posible.

### Plantillas (texto exacto a usar, completar con datos del diff)

**T1 — Endpoint nuevo**:
```markdown
### `{METHOD} {path}`

{Una frase: qué hace el endpoint, en lenguaje de producto.}

- **Auth**: {required | public}
- **Request**: {forma del body o query, en bullets}
- **Response 2xx**: {schema mínimo en bullets}
- **Errores conocidos**: {códigos relevantes — solo si el handler los declara explícitamente}
- **Ticket**: {TICKET_ID}
```

**T2 — Breaking change**:
```markdown
> ⚠️ **Breaking en {TICKET_ID}**: {qué cambió en una frase}. Migración: {acción que debe tomar el consumidor}.
```
Agregar este callout al inicio de la sección del endpoint afectado.

**T3 — Variable de entorno**:
```markdown
- `{NOMBRE_VAR}` — {descripción de 1 línea, derivada del comentario del .env.example si existe}. Requerida en {dev/prod/ambos}. (`{TICKET_ID}`)
```

**T4 — CLI / script**:
```markdown
### `{comando}`

{Una frase: para qué sirve}.

```bash
{ejemplo de uso, una sola línea}
```
({TICKET_ID})
```

**T5 — Deploy / CI**:
```markdown
- **{TICKET_ID}**: {qué cambió en CI/deploy en una frase}. Impacto operativo: {qué tiene que saber quien deploya}.
```

**T6 — Webhook / evento**:
```markdown
### {tipo de evento o webhook}

{Una frase: qué dispara este evento o webhook}.

- **Origen / Destino**: {externo o servicio interno}
- **Payload**: {schema mínimo}
- **Ticket**: {TICKET_ID}
```

**T7 — Nuevo flow de usuario**:
```markdown
# {Nombre del flow}

> Ticket: {TICKET_ID}

## Pasos

1. {paso 1, derivado del componente / ruta}
2. ...

## Estados / edge cases

- {solo los que el código maneja explícitamente}
```

**T8 — Migración de DB**:
```markdown
- **{TICKET_ID}**: {qué cambió en el esquema en una frase}. Backfill: {sí/no}. Reversible: {sí/no}.
```

### Reglas estrictas de redacción

- **Una frase por concepto**. No prosa extensa.
- **Sin marketing, sin "obvious", sin "simply"**.
- **Sin "este PR" / "este ticket"** en el cuerpo del doc (la referencia al ticket va en línea de atribución).
- **Cero placeholders sin completar**. Si no podés extraer el dato del diff, NO inventes — preguntá al usuario o omití ese campo.
- **NO copies bloques de código completos** del diff. Solo lo esencial para entender la superficie (signature, schema mínimo).
- **NO listes "archivos modificados"**. Eso pertenece a la evidencia (`docs/evidence/`), no a Docusaurus.

## 5. Decisión final + registro

### Caso A — Ningún trigger disparó (mayoritario)

```
Llamar: sdd_register_docs_decision({
  status: "skipped",
  reason: "<razón específica derivada del análisis del diff>",
  files: []
})
```

Razones aceptables (ejemplos):
- "refactor interno sin cambio de contratos públicos"
- "bug fix sin modificación de superficie pública"
- "tests adicionales sin nueva funcionalidad documentable"
- "estilos / lint sin cambio de comportamiento"
- "bump de dependencias sin cambio de API"
- "cambios solo en código interno / utilities sin export público"

Razones inaceptables (rechazar y re-evaluar):
- "no aplica", "nada", "no hace falta", "menor", "trivial"

Mostrar al usuario:
```
📚 Docs: skipped — <razón>
```

### Caso B — Al menos un trigger disparó

1. Listar al usuario qué triggers detectaste y qué archivos vas a tocar:
   ```
   📚 Docs detectados:
     • T1 endpoint nuevo → {path/api.md} (sección "Sessions")
     • T3 env var nueva  → {path/processes/env-vars.md}
   
   ¿Procedo a escribir?
   ```
2. **AskUserQuestion** (single_select):
   - `"Sí, escribir"` → ir al paso 3.
   - `"Skip — yo lo hago manual"` → registrar `skipped` con razón "dev prefiere escribir manualmente" y terminar.
   - `"Skip — el trigger es falso positivo"` → registrar `skipped`, pedir al usuario la razón concreta del falso positivo, y guardarla para mejorar el clasificador.
3. Escribir cada archivo. Si el archivo destino NO existe, crearlo. Si existe, hacer merge agregando al final de la sección correspondiente (no sobreescribir).
4. Llamar:
   ```
   sdd_register_docs_decision({
     status: "updated",
     reason: "<lista corta de triggers, ej. 'T1 endpoint POST /sessions; T3 env var SESSION_SECRET'>",
     files: ["<paths relativos al repo>"]
   })
   ```
5. Mostrar resumen:
   ```
   📚 Docs actualizados:
     ✅ {path1}
     ✅ {path2}
   
   Triggers: T1, T3
   ```

## 6. Protecciones

- **Nunca** modificar `docusaurus.config.{js,ts,mjs,cjs}`. Si el sidebar es manual,
  tampoco tocar `sidebars.{js,ts,json}` — solo agregar archivos a carpetas que
  ya existen. Si la carpeta destino no existe y el sidebar es manual, **registrar
  skipped** con razón "carpeta no existe en sidebar curado — agregar manualmente".
- **Nunca** escribir en `versioned_docs/` ni en `i18n/`.
- **Nunca** ejecutar `npm run build` desde este comando — es responsabilidad del CI.
- **Nunca** generar doc para tickets cuyo único cambio es archivos de test, lint, o deps.
- **Si el ticket está en un subproject que no aparece en `SDD_SUBPROJECT_SLUGS`** →
  registrar `skipped` con razón "target subproject inválido — revisar config".

# Atribución en el ticket

El comentario al ticket lo escribe `/commit`. Si hay decisión de docs registrada
en el state, `/commit` la incluye en la sección "Qué se hizo" como una línea:
- `📚 Docs: actualizado en {N archivos}` (cuando `status="updated"`)
- `📚 Docs: no aplica — <razón>` (cuando `status="skipped"`)

Este comando NO comenta el ticket por sí mismo — solo registra la decisión.

# Resumen del comportamiento

1. Si Docusaurus no está habilitado → este comando no existe operativamente.
2. Si el diff no dispara ningún trigger → `skipped` automático con razón derivada.
3. Si dispara triggers → mostrar al usuario, pedir confirmación, escribir mínimo, registrar.
4. Nunca documentar refactors, fixes sin superficie, tests, deps, lint.
5. Nunca tocar config de Docusaurus ni sidebars curados.
6. La decisión queda en `pipeline-state.json` y bloquea `sdd_advance(COMMIT)` si falta.
