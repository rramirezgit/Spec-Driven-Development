<!-- sdd-version: 3.0 -->
# Role
Senior engineer + QA liaison. Genera el archivo histórico de evidencia QA del ticket
en `docs/evidence/{TICKET_ID}.md`.

> **V4.13**: simplificado — antes lanzaba 2 agents (QA + cross-team docs), ahora solo
> 1 agent enfocado en evidencia. La documentación cross-team (`docs/api/*.md`,
> `docs/components/*.md`) es responsabilidad **única** de `/generate-docs` para evitar
> el race "last-write-wins" que ocurría cuando ambos comandos escribían los mismos paths.

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

## 3. Generar archivo histórico de evidencia QA

Skip si `--docs-only`. Crear `docs/evidence/{TICKET_ID}.md` usando el evidence template de
`ai-specs/specs/documentation-standards.mdc` sección "Reference Templates".

Contenido:
- Resumen de qué se hizo y por qué (3-5 frases)
- Links:
  - PR (si existe)
  - Evidencia (este archivo)
  - Doc técnica relacionada (si `/generate-docs` la actualizó después del ticket)
- Tabla de archivos modificados (ruta | tipo de cambio | descripción)
- Tests: cuáles corren y resultado, o `[Sin tests — verificación manual requerida]`
- Pasos de verificación manual para QA (prerrequisito → acción → resultado esperado)
- Casos edge a verificar
- Notas para QA: ambiente, datos de prueba, dependencias

> **Idioma**: el definido en `AGENTS.md` § Language o español por default.
> **Reglas**: NO inventar endpoints, DTOs ni comportamientos. Si algo no se puede inferir,
> marcar `[POR COMPLETAR — preguntar a {equipo}]`.

> **`docs/api/` y `docs/components/` NO se generan acá.** Esos viven bajo la
> responsabilidad única de `/generate-docs` (que tiene visión completa del proyecto, no solo
> del ticket actual). Si necesitás actualizar API/components doc después de un cambio,
> ejecutá `/generate-docs` o `/generate-docs --update`.

## 4. Resumen al usuario

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
- `docs/README.md` — actualizado si hay archivos nuevos en docs/evidence/

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