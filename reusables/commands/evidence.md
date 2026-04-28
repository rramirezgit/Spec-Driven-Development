<!-- sdd-version: 2.0 -->
# Role
Senior engineer + QA liaison. Orquesta un **team de 2 agents Explore en paralelo** para
generar evidencia QA + documentación técnica cross-team en /docs.

# Arguments
`$ARGUMENTS` — Ticket ID (ej: AUTH-123, BACK-45 — el formato depende del proyecto en el tracker), "current" para inferir del branch, o flag `--docs-only`.
- `TICKET-ID` → evidencia completa + doc cross-team
- `TICKET-ID --docs-only` → solo doc técnica (sin reporte QA)
- `--docs-only` (sin ID) → documenta cambios del branch actual

# Process

## 0. Resolver ticket
- ID explícito → usar directamente
- "current" o vacío → inferir de branch name (`feature/{TICKET-ID}-*` → extraer el ID)
- Si no se puede inferir y no es `--docs-only` → preguntar

## 1. Recopilar contexto

```bash
# Archivos modificados en este branch vs main
git diff main...HEAD --name-only

# Diff completo (para análisis)
git diff main...HEAD --stat

# Tests relevantes (si existen)
# Detectar archivos de test que corresponden a los archivos modificados

# GitHub repo URL y branch (para links en evidencia)
gh repo view --json url -q .url 2>/dev/null || git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|'
git branch --show-current

# PR del branch actual (si existe)
gh pr view --json url -q .url 2>/dev/null || echo "NO_PR"
```

Construir internamente:
```
GH_REPO_URL: https://github.com/{owner}/{repo}
GH_BRANCH: {branch actual}
GH_PR_URL: {url del PR o "NO_PR"}
```

> Si no se puede obtener el repo URL: usar paths relativos como fallback. No bloquear.

Leer cada archivo modificado para entender qué se hizo.

Si el MCP de tickets está disponible: fetch del ticket para obtener título, descripción, criterios.
Si no: pedir al dev que describa brevemente.

## 2. Clasificar el tipo de cambio

| Tipo | Señales | Doc cross-team |
|------|---------|----------------|
| Backend API | Archivos en routes/, controllers/, services/, endpoints | Para Frontend: endpoints, DTOs, request/response, auth |
| Backend Logic | services/, utils/, models/ sin nuevos endpoints | Para Frontend: cambios en comportamiento |
| Frontend UI | components/, pages/, views/ | Para Backend: nuevos datos que necesita, estados |
| Frontend Logic | hooks/, stores/, utils/ | Para Backend: cambios en consumo de API |
| Fullstack | Ambos | Doc completa bidireccional |
| Infra/Config | CI, Docker, configs | Para todos: qué cambió en el entorno |
| Fix/Bugfix | Cualquiera | Bug, causa raíz, fix aplicado |

## 3. Lanzar team de 2 agents en paralelo

> **CRÍTICO**: las 2 invocaciones de `Agent` deben ir en **un único mensaje** con
> múltiples tool uses para que se ejecuten realmente en paralelo. Si las mandás
> secuenciales se pierde la ganancia (~40% más lento).
>
> **Por qué team aplica acá**: lectura + redacción son paralelizables. Cada agent
> escribe a un directorio distinto (`docs/evidence/` vs `docs/api|components/`),
> sin conflictos de archivos.

### Agent 1 — QA Evidence (subagent_type: Explore)

Skip si `--docs-only`.

```
"Generá la evidencia QA para el ticket {TICKET_ID}.

Contexto disponible:
- TICKET_ID: {TICKET_ID}
- Ticket info (si MCP del tracker disponible): {título, descripción, criterios}
- Diff vs main: {git diff main...HEAD --stat}
- GH_REPO_URL: {url}
- GH_BRANCH: {branch}
- GH_PR_URL: {url o NO_PR}
- Tipo de cambio: {Backend API / Backend Logic / Frontend UI / Frontend Logic / Fullstack / Infra / Fix}

Tareas:
1. Leé los archivos modificados (los que aparecen en git diff main...HEAD --name-only)
   para entender QUÉ cambió (no solo dónde).
2. Crear docs/evidence/{TICKET_ID}.md usando el evidence template de
   ai-specs/specs/documentation-standards.mdc sección 'Reference Templates'.
3. Contenido:
   - Resumen de qué se hizo y por qué (3-5 frases)
   - Links: PR (si existe), Evidencia, Doc técnica
   - Tabla de archivos modificados (ruta | tipo de cambio | descripción)
   - Tests: cuáles corren y resultado, o '[Sin tests — verificación manual requerida]'
   - Pasos de verificación manual para QA (prerrequisito → acción → resultado esperado)
   - Casos edge a verificar
   - Notas para QA: ambiente, datos de prueba, dependencias

Restricciones:
- Espacio de escritura EXCLUSIVO: docs/evidence/{TICKET_ID}.md y subdirectorios
  bajo docs/evidence/. NO toques docs/api/ ni docs/components/ (los maneja Agent 2).
- Idioma: el definido en AGENTS.md § Language. Si no hay AGENTS.md, español.
- Si algo no se puede inferir: marcá '[POR COMPLETAR — preguntar a {equipo}]'.
- NO inventes endpoints, DTOs ni comportamientos que no estén en el código.

Reportá: ruta del archivo creado + 1 línea de resumen del contenido."
```

### Agent 2 — Cross-team Documentation (subagent_type: Explore)

Siempre se ejecuta (incluso con `--docs-only`).

```
"Generá la documentación técnica cross-team para los cambios del branch actual.

Contexto disponible:
- TICKET_ID: {TICKET_ID o '(sin ticket)' si --docs-only sin ID}
- Diff vs main: {git diff main...HEAD --name-only}
- Tipo de cambio: {Backend / Frontend / Fullstack / Infra}
- ai-specs/specs/documentation-standards.mdc (templates de referencia)

Tareas:
- Si el cambio toca BACKEND (routes/, controllers/, services/, endpoints):
  Actualizá o creá docs/api/{modulo}.md usando el endpoint template.
  - Endpoints con method, ruta, auth, headers, params, body, response, errores
  - Ejemplos basados en DTOs/schemas REALES del código (NO inventar)
  - Notas de implementación (reglas de negocio, limitaciones)
  - Ejemplo de uso para frontend

- Si el cambio toca FRONTEND (components/, pages/, hooks/, stores/):
  Actualizá o creá docs/components/{modulo}.md usando el component template.
  - Ubicación, descripción, props
  - Datos que consume (endpoint, hook, campos usados)
  - Estados (loading, empty, error, success)
  - Datos que necesita del backend

- Si fullstack: AMBOS docs.

Restricciones:
- Espacio de escritura EXCLUSIVO: docs/api/, docs/components/. NO toques
  docs/evidence/ (lo maneja Agent 1).
- Si actualizás un archivo existente: solo modificar secciones afectadas, marcar
  con '> 🆕 Actualizado por {TICKET_ID} ({FECHA})'.
- Idioma según AGENTS.md § Language o español por default.
- NUNCA inventar comportamientos. '[POR COMPLETAR — preguntar a {equipo}]' si falta info.

Reportá: rutas de archivos creados/modificados + 1 línea de resumen por cada uno."
```

## 4. Consolidación post-team (secuencial)

Cuando los 2 agents reporten, ejecutar acá (en main agent, NO en sub-agents):

## 5. Actualizar índice

Agregar entrada en `docs/README.md` sección Changelog si hay archivos nuevos.

## 6. NO comentar en ticket desde /evidence

> El comentario al tracker se hace ÚNICAMENTE desde `/commit` (sección 7.3 del commit.md).
> `/evidence` solo genera archivos locales. El comentario completo para QA se deja al hacer commit+merge.

## 7. Preview y confirmación

Mostrar al dev:
- Resumen de lo generado
- Preguntar: "¿Querés ajustar algo antes de commitear?"

# Output
- `docs/evidence/{TICKET_ID}.md` — creado (solo si no es --docs-only)
- `docs/{api|components}/{modulo}.md` — creado/actualizado
- `docs/README.md` — actualizado si hay archivos nuevos

# Rules
- **Idioma**: TODA la evidencia y documentación cross-team se escribe en el idioma definido en `AGENTS.md` § Language para docs. Si no hay AGENTS.md, usar español. Esto incluye: títulos, descripciones, resúmenes, notas para QA, comentarios en tickets.
- NUNCA inventar endpoints, DTOs o comportamientos que no estén en el código
- Si algo no se puede inferir: `[POR COMPLETAR — preguntar a {equipo}]`
- Ejemplos de request/response basados en schemas/tipos REALES del código
- Si no hay tests: decirlo claramente, no inventar coverage
- Usar templates de `documentation-standards.mdc` — no inline templates
- Si actualiza un archivo existente: solo modificar secciones afectadas, marcar con `> 🆕 Actualizado por {TICKET_ID} ({FECHA})`
- Degradar graciosamente si MCP no disponible
- No asumir formato de ticket ID — usar el ID exacto que provee el tracker del proyecto