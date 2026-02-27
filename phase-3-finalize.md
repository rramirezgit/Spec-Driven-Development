<!-- FASE 5b-7: Docs base + OpenSpec + Verificación -->

## Pre-check

```bash
test -f .ai-internal/project-profile.md && echo "PERFIL_OK" || echo "PERFIL_MISSING"
test -d .claude/commands/opsx && echo "REUSABLES_OK" || echo "REUSABLES_MISSING"
test -f CLAUDE.md && echo "ADAPTED_OK" || echo "ADAPTED_MISSING"
```

Si falta algo: DETENER.

Leer `.ai-internal/project-profile.md` completo.

---

### 5b — Generar contenido base de /docs

Usando el `PROYECTO_PERFIL`, generar archivos base con contenido real (no dirs vacíos):

#### `docs/README.md`
```markdown
# {nombre} — Documentación técnica

> Última actualización: {FECHA_HOY}
> Generado con Bootstrap V4.1

## Índice

- [Arquitectura](./arquitectura.md) — Stack, servicios, diagramas
- [Setup](./setup.md) — Instalación y configuración
- [API](./api/README.md) — Endpoints por módulo
{si frontend: "- [Componentes](./components/README.md) — UI components por módulo"}
- [Flujos](./flujos.md) — Flujos principales del sistema
- [Decisiones](./decisiones.md) — ADRs (Architecture Decision Records)
- [Despliegue](./despliegue.md) — CI/CD, ambientes, rollback
- [Evidencia](./evidence/README.md) — Evidencia de completitud por ticket

## Estructura del proyecto

```
{tree_real_del_proyecto — output de find con max-depth 3}
```

## Convenciones
- Idioma técnico: {idioma_tecnico}
- Idioma UI: {idioma_ui}
- Documentación: {idioma_tecnico}
- Commits: inglés

> Para generar documentación completa: ejecutar `/generate-docs`
> Para documentar un ticket: ejecutar `/evidence TICKET-ID`

## Changelog

| Fecha | Ticket | Descripción | Archivos |
|-------|--------|-------------|----------|
| {FECHA_HOY} | — | Estructura inicial | docs/ |
```

#### `docs/api/README.md`
```markdown
# API — {nombre}

> Última actualización: {FECHA_HOY}

## Autenticación
{metodo_auth_detectado o "[POR COMPLETAR]"}

## Base URL
- Development: `{env_var_api_dev o "[POR COMPLETAR]"}`

## Convenciones
> Patrones de API detallados en: `ai-specs/specs/{tipo}-standards.mdc` secciones 6-8

## Módulos
{lista_de_modulos_si_se_detectaron o "Ejecutar `/generate-docs` para popular esta sección."}
```

#### `docs/evidence/README.md`
```markdown
# Evidencia de tickets

> Cada ticket completado genera un archivo de evidencia aquí.
> Comando: `/evidence TICKET-ID`

## Qué incluye cada archivo de evidencia
- Resumen de cambios
- Archivos modificados
- Pasos de verificación para QA
- Documentación cross-team
- Casos edge a testear

## Flujo recomendado
```
/develop-{tipo} <ID> → /evidence <ID> → /commit <ID>
```

## Índice

| Fecha | Ticket | Título | Autor |
|-------|--------|--------|-------|
{se_llena_automáticamente_con_cada_/evidence}
```

#### `docs/assets/README.md`
```markdown
# Assets — Diagramas

## Convenciones
- Formato fuente: `.excalidraw` (editable)
- Formato referencia: `.svg` (para markdown)
- Nombres: `{tipo}-{descripcion}.svg` (ej: `flujo-autenticacion.svg`)
- Paleta: fondo blanco, cajas #e3f2fd, acciones #e8f5e9, errores #ffebee, texto negro

## Cómo generar un diagrama con IA
Usar los prompts de Excalidraw en comentarios HTML de `flujos.md` o `arquitectura.md`.
```

{Si frontend: generar también `docs/components/README.md` con estructura similar a api/README.md}

Mostrar al usuario: "✅ Estructura /docs creada con contenido base. Para documentación completa, ejecutar `/generate-docs` después del bootstrap."

---

### `ai-specs/AI-WORKFLOW-PLAYBOOK.md`

```markdown
# AI Workflow Playbook — {nombre}

## Índice
1. Vista general
2. Estructura de archivos
3. Flujos de trabajo
4. Comandos disponibles
5. Agentes especializados
6. Integraciones externas
7. Standards y specs
8. Guía para replicar en otro proyecto
9. Guía para ampliar
10. Bootstrap prompt

---

## 1. Vista general

```
Idea → Planificación → Tickets → Plan técnico → Código → Commit/PR
        (OpenSpec)    ({tracker}) (plan-ticket) (develop)  (commit)
```

### Principios
- Un solo punto de entrada: `/menu`
- Cada comando hace una cosa bien
- Confirmación antes de actuar en sistemas externos
- Idioma: {idioma_ui} para tickets/UI | {idioma_tecnico} para código/docs
- Degradación graciosa: si un MCP o tool externo no está disponible, el flujo continúa

---

## 2. Estructura de archivos

```
{nombre}/
├── .claude/
│   ├── commands/
│   │   ├── menu.md
│   │   ├── create-{tracker}-tickets.md
│   │   └── opsx/ (10 comandos)
│   └── skills/
│       └── openspec-*/ (10 skills — generados por openspec init)
├── ai-specs/
│   ├── AI-WORKFLOW-PLAYBOOK.md
│   ├── .agents/
│   │   ├── {tipo}-developer.md
│   │   └── product-strategy-analyst.md
│   ├── .commands/
│   │   ├── develop-{tipo}.md
│   │   ├── plan-{tipo}-ticket.md
│   │   ├── enrich-ticket.md
│   │   ├── commit.md
│   │   ├── review-pr.md
│   │   ├── test-plan.md
│   │   ├── evidence.md
│   │   ├── generate-docs.md
│   │   ├── explain.md
│   │   ├── meta-prompt.md
│   │   └── update-docs.md
│   ├── specs/
│   │   ├── base-standards.mdc
│   │   ├── documentation-standards.mdc
│   │   ├── {tipo}-standards.mdc
│   │   {+ ui-design-system.mdc si aplica}
│   ├── changes/
│   │   ├── archive/
│   │   └── strategy/
├── docs/
│   ├── README.md
│   ├── arquitectura.md
│   ├── api/
│   │   ├── README.md
│   │   └── {modulo}.md (generado por /evidence o /generate-docs)
│   ├── components/ (si frontend)
│   │   ├── README.md
│   │   └── {modulo}.md
│   ├── evidence/
│   │   ├── README.md
│   │   └── {TICKET-ID}.md (generado por /evidence)
│   ├── setup.md
│   ├── flujos.md
│   ├── decisiones.md
│   ├── despliegue.md
│   └── assets/
│       ├── README.md
│       └── *.svg
├── openspec/
│   ├── config.yaml
│   ├── specs/
│   └── changes/archive/
├── CLAUDE.md
├── AGENTS.md
└── .bootstrap-meta.json
```

---

## 3. Flujos de trabajo

### Flujo 1: Feature nuevo
| Paso | Comando | Qué hace |
|------|---------|----------|
| 1 | `/opsx:ff` | Genera artefactos de planificación |
| 2 | `/create-{tracker}-tickets` | Crea tickets |
| 3 | `/plan-{tipo}-ticket <ID>` | Plan técnico |
| 4 | `/develop-{tipo} <ID>` | Implementa |
| 5 | `/evidence <ID>` | Evidencia QA + doc cross-team |
| 6 | `/commit` | Commit + PR + transición ticket |
| 7 | `/opsx:verify` | Verifica completitud |
| 8 | `/opsx:archive` | Archiva change |

### Flujo 2: Ticket existente
| Paso | Comando | Qué hace |
|------|---------|----------|
| 1 | `/enrich-ticket <ID>` | Enriquecer si falta detalle |
| 2 | `/plan-{tipo}-ticket <ID>` | Plan técnico |
| 3 | `/develop-{tipo} <ID>` | Implementar |
| 4 | `/evidence <ID>` | Evidencia QA + doc cross-team |
| 5 | `/commit <ID>` | Commit + PR + transición |

### Flujo 3: Exploración
`/opsx:explore` → `/opsx:new` (capturar insights)

### Flujo 4: Directo
`/develop-{tipo}` → `/evidence` (si tiene ticket) → `/commit`

### Flujo 5: Review
`/review-pr <número>`

### Flujo 6: Testing
`/test-plan <ticket o feature>`

### Flujo 7: Documentación (standalone)
| Paso | Comando | Qué hace |
|------|---------|----------|
| 1 | `/generate-docs` | Docs completos (primera vez, iterativo) |
| 2 | `/generate-docs update` | Actualiza docs por cambios recientes |

---

## 4. Comandos disponibles

| Comando | Descripción | Tipo |
|---------|-------------|------|
| `/menu` | Menú principal | Wizard |
| `/opsx:ff` | Nuevo change (fast-forward) | Reusable |
| `/opsx:new` | Nuevo change (paso a paso) | Reusable |
| `/opsx:continue` | Continuar change | Reusable |
| `/opsx:apply` | Implementar tareas | Reusable |
| `/opsx:verify` | Verificar implementación | Reusable |
| `/opsx:archive` | Archivar change | Reusable |
| `/opsx:explore` | Modo exploración | Reusable |
| `/opsx:sync` | Sincronizar specs | Reusable |
| `/opsx:bulk-archive` | Archivar múltiples | Reusable |
| `/opsx:onboard` | Tutorial guiado | Reusable |
| `/create-{tracker}-tickets` | Crear tickets | Adaptado |
| `/enrich-ticket` | Enriquecer ticket | Adaptado |
| `/plan-{tipo}-ticket` | Plan técnico | Adaptado |
| `/develop-{tipo}` | Implementar | Adaptado |
| `/commit` | Commit + PR + transición | Reusable |
| `/review-pr` | Review de PR | Reusable |
| `/test-plan` | Plan de testing | Reusable |
| `/evidence` | Evidencia QA + doc cross-team | Reusable |
| `/evidence --docs-only` | Solo doc técnica | Reusable |
| `/generate-docs` | Docs completos del proyecto | Reusable |
| `/explain` | Modo aprendizaje | Reusable |
| `/update-docs` | Actualizar docs | Reusable |

---

## 5. Agentes especializados

### {Tipo} Developer
- Archivo: `ai-specs/.agents/{tipo}-developer.md`
- Modelo: sonnet
- Usado por: `/plan-{tipo}-ticket`, `/develop-{tipo}`

### Product Strategy Analyst
- Archivo: `ai-specs/.agents/product-strategy-analyst.md`
- Modelo: opus
- Usado por: exploración y planificación estratégica

---

## 6. Integraciones externas

### {Tracker} ({Jira/Linear/GitHub Issues})
{si_jira:}
**CloudId**: {jira_cloud_id}
**MCP prefix**: {atlassian_prefix}

Herramientas disponibles (usar con el prefijo detectado):
- getJiraIssue
- createJiraIssue
- editJiraIssue
- transitionJiraIssue
- searchJiraIssuesUsingJql
- addCommentToJiraIssue

Comandos que lo usan: `/create-{tracker}-tickets`, `/enrich-ticket`, `/commit` (transición)

**Degradación**: Si MCP no disponible, los comandos piden input manual o generan texto copiable.

### Figma {si_aplica}
**MCP prefix**: {figma_prefix}
Comandos que lo usan: `/develop-{tipo}` (referencia de diseño)

### GitHub (`gh` CLI)
**Status**: {available | not_found}
Usado por `/commit` para crear PRs.
**Degradación**: Si no disponible, muestra resumen para PR manual.

---

## 7. Standards y specs

| Spec | Contenido | Cuándo actualizar |
|------|-----------|------------------|
| `base-standards.mdc` | Principios, naming, idioma | Cambios en convenciones |
| `documentation-standards.mdc` | Proceso de docs | Cambios en proceso |
| `{tipo}-standards.mdc` | Stack completo, patrones | Nuevos patrones, deps, estructura |
| `ui-design-system.mdc` | Tema, paleta, componentes | Cambios en tema/UI |

---

## 8. Guía para replicar

### Paso 1: Reusables (copiar exactamente)
- `.claude/commands/opsx/*.md` (10 archivos)
- `ai-specs/.commands/explain.md`
- `ai-specs/.commands/meta-prompt.md`
- `ai-specs/.commands/commit.md`
- `ai-specs/.commands/update-docs.md`
- `ai-specs/.commands/review-pr.md`
- `ai-specs/.commands/test-plan.md`
- `ai-specs/.commands/evidence.md`
- `ai-specs/.commands/generate-docs.md`
- `ai-specs/.agents/product-strategy-analyst.md`

### Paso 2: Adaptados (personalizar por proyecto)
Ver BOOTSTRAP-PROMPT-V4.md

### Checklist
- [ ] `/menu` muestra menú con 7 opciones
- [ ] `/opsx:onboard` inicia tutorial
- [ ] `/explain test` da explicación estructurada
- [ ] CLAUDE.md sin placeholders `{}`
- [ ] `openspec/config.yaml` con contexto real
- [ ] `ai-specs/specs/{tipo}-standards.mdc` refleja el codebase real
- [ ] `.bootstrap-meta.json` existe con versión correcta
- [ ] `docs/` estructura creada con contenido base
- [ ] `/evidence` command funciona

---

## 9. Guía para ampliar

### Nuevo comando
1. Crear `.md` en `.claude/commands/` o subdirectorio
2. Frontmatter: name, description, category, tags
3. Steps, output, guardrails
4. Agregar a tabla del playbook
5. Actualizar `/menu` si es relevante

### Nuevo agente
1. Crear en `ai-specs/.agents/`
2. Frontmatter: name, description, model, color
3. Role, expertise, rules
4. Referenciar desde comandos

### Ideas de ampliación
- `/deploy` — deployment workflow
- `/changelog` — generar CHANGELOG desde commits
- Agente QA especializado
- `/review-design` — review de maquetas Figma antes de implementar

---

## 10. Bootstrap prompt
**Archivo**: `ai-specs/BOOTSTRAP-PROMPT-V4.1.md`
**Versión**: V4.1
**Uso**: Correr `/init` en Claude Code, luego pegar el prompt.
El prompt lee el codebase automáticamente y solo pregunta lo que no puede inferir.
Soporta re-ejecución segura con backups y protección de archivos editados.
Incluye generación de /docs con contenido base y comandos de evidencia.
```

---

## FASE 6: Inicializar OpenSpec

> `openspec-cli` ya debe estar instalado y verificado — validado en Fase 0, paso 0.0.
> Si llegaste hasta acá, openspec está disponible y es compatible.

```bash
openspec init
```

> `openspec init` genera los directorios `.claude/skills/openspec-*/` con sus SKILL.md.
> En V4 ya no creamos estos archivos manualmente — `openspec init` es la única fuente.
>
> Si el comando falla, reportá el error exacto y no continúes a la Fase 7.

---

## FASE 7: Verificación y metadata

### 7.1 — Crear metadata de bootstrap

```bash
cat > .bootstrap-meta.json << 'EOF'
{
  "bootstrap_version": "4.1",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "openspec_version": "$(openspec --version 2>/dev/null)",
  "project_name": "{nombre}",
  "project_type": "{tipo}",
  "framework": "{framework}",
  "tracker": "{tracker}",
  "mcps_detected": {
    "atlassian": "{atlassian_status}",
    "github": "{github_status}",
    "figma": "{figma_status}"
  },
  "protected_files": [],
  "previous_version": "{version_previa_o_null}"
}
EOF
```

> Reemplazá los valores con los datos reales del perfil antes de escribir el archivo.

### 7.2 — Verificación completa

Ejecutá y reportá el resultado de cada check:

```bash
echo "=== ESTRUCTURA ==="
ls .claude/commands/opsx/ | wc -l | xargs echo "opsx commands:"
ls .claude/skills/ 2>/dev/null | wc -l | xargs echo "skills:"
ls ai-specs/.commands/ | wc -l | xargs echo "ai-specs commands:"
ls ai-specs/specs/ | wc -l | xargs echo "specs:"

echo ""
echo "=== ARCHIVOS CLAVE ==="
for f in CLAUDE.md AGENTS.md openspec/config.yaml .claude/commands/menu.md ai-specs/AI-WORKFLOW-PLAYBOOK.md .bootstrap-meta.json; do
  test -f "$f" && echo "✅ $f" || echo "❌ $f FALTANTE"
done

echo ""
echo "=== DOCS STRUCTURE ==="
for d in docs docs/api docs/evidence docs/assets; do
  test -d "$d" && echo "✅ $d/" || echo "❌ $d/ FALTANTE"
done

for f in docs/README.md docs/api/README.md docs/evidence/README.md docs/assets/README.md; do
  test -f "$f" && echo "✅ $f" || echo "❌ $f FALTANTE"
done

echo ""
echo "=== DOCS COMMANDS ==="
for f in ai-specs/.commands/evidence.md ai-specs/.commands/generate-docs.md; do
  test -f "$f" && echo "✅ $f" || echo "❌ $f FALTANTE"
done

echo ""
echo "=== PLACEHOLDERS PENDIENTES ==="
# Regex mejorado: busca {palabra_underscore} pero ignora:
# - Líneas de código (empiezan con espacios + código)
# - Bloques de bash/yaml/json (llaves legítimas)
# - Template literals de JS/TS
# - Patrones de 1-2 caracteres como {f} {i} (variables de loop)
grep -rnE "\{[a-z][a-z_]{2,}\}" \
  ai-specs/specs/*.mdc \
  CLAUDE.md \
  AGENTS.md \
  openspec/config.yaml \
  ai-specs/.agents/*.md \
  ai-specs/.commands/*.md \
  .claude/commands/menu.md \
  .claude/commands/create-*-tickets.md \
  2>/dev/null \
  | grep -v "node_modules" \
  | grep -v ".git/" \
  | grep -vE "^\s*(#|//|```|\*)" \
  | grep -vE "\{(ID|feature|slug|name|ticket_id|resource|change|number|ID|desc|ticket|número)\}" \
  | grep -vE "\\$\{" \
  | grep -vE "^\s*-\s*\`" \
  | head -20

echo ""
echo "=== MCP TOOLS EN ARCHIVOS ==="
# Verificar que no hay MCP tools hardcoded incorrectamente
HARDCODED=$(grep -rn "mcp__claude_ai_" ai-specs/ .claude/commands/ 2>/dev/null | head -5)
if [ -n "$HARDCODED" ]; then
  echo "⚠️  MCP tools con prefijo hardcoded 'mcp__claude_ai_' detectados:"
  echo "$HARDCODED"
else
  echo "✅ No hay MCP tools hardcoded"
fi

echo ""
echo "=== RESUMEN ==="
echo "Bootstrap version: $(cat .bootstrap-meta.json | grep -o '"bootstrap_version":"[^"]*"' | cut -d'"' -f4)"
echo "Si hay placeholders pendientes arriba: corregirlos antes de usar el sistema."
echo "Si todo está ✅: el sistema está listo."
```

**Checklist final** (confirmá cada uno):
- [ ] `ls .claude/commands/opsx/` muestra 10 archivos
- [ ] `ls .claude/skills/` muestra 10 directorios (generados por openspec init)
- [ ] `/menu` muestra el menú interactivo con 7 opciones
- [ ] `/opsx:onboard` inicia el tutorial
- [ ] `CLAUDE.md` refleja el stack real (sin `{word_word}` sin reemplazar)
- [ ] `openspec/config.yaml` tiene contexto completo (sin `{word_word}`)
- [ ] `ai-specs/specs/{tipo}-standards.mdc` documenta patrones reales del codebase
- [ ] El nombre del agente (`{tipo}-developer.md`) coincide con el tipo del proyecto
- [ ] `.bootstrap-meta.json` existe con versión `4.1`
- [ ] No hay MCP tools hardcoded con prefijos obsoletos
- [ ] Si re-ejecución: backups creados en `.bootstrap-backup/`
- [ ] `docs/` estructura creada (api/, evidence/, assets/)
- [ ] `docs/README.md` tiene contenido base (no vacío)
- [ ] `docs/evidence/README.md` tiene convenciones
- [ ] `/evidence` command existe en `ai-specs/.commands/`
- [ ] `/generate-docs` command existe en `ai-specs/.commands/`
- [ ] `/commit` incluye evidence check (paso 2)

---

## TABLA FINAL DE ARCHIVOS

### Reusables (idénticos en cualquier proyecto)

| Archivo | Descripción |
|---------|-------------|
| `.claude/commands/opsx/new.md` | OpenSpec: nuevo change paso a paso |
| `.claude/commands/opsx/ff.md` | OpenSpec: fast-forward |
| `.claude/commands/opsx/continue.md` | OpenSpec: continuar change |
| `.claude/commands/opsx/apply.md` | OpenSpec: implementar tareas |
| `.claude/commands/opsx/verify.md` | OpenSpec: verificar implementación |
| `.claude/commands/opsx/archive.md` | OpenSpec: archivar change |
| `.claude/commands/opsx/explore.md` | OpenSpec: modo exploración |
| `.claude/commands/opsx/sync.md` | OpenSpec: sincronizar specs |
| `.claude/commands/opsx/bulk-archive.md` | OpenSpec: archivar múltiples |
| `.claude/commands/opsx/onboard.md` | OpenSpec: tutorial guiado |
| `ai-specs/.commands/explain.md` | Modo aprendizaje |
| `ai-specs/.commands/meta-prompt.md` | Mejora de prompts |
| `ai-specs/.commands/commit.md` | Commit + PR + transición ticket |
| `ai-specs/.commands/update-docs.md` | Actualizar documentación |
| `ai-specs/.commands/review-pr.md` | Review de pull requests |
| `ai-specs/.commands/test-plan.md` | Generar plan de testing |
| `ai-specs/.agents/product-strategy-analyst.md` | Agente estrategia |

### Generados por openspec init

| Archivo | Descripción |
|---------|-------------|
| `.claude/skills/openspec-*/SKILL.md` | 10 skills metadata (generados por CLI) |

### Adaptados (generados automáticamente desde el codebase)

| Archivo | Inferido de |
|---------|-------------|
| `CLAUDE.md` | package.json + estructura + archivos clave |
| `AGENTS.md` | Stack + naming conventions del codebase |
| `openspec/config.yaml` | Perfil completo del proyecto |
| `ai-specs/AI-WORKFLOW-PLAYBOOK.md` | Configuración completa |
| `ai-specs/.agents/{tipo}-developer.md` | Stack + patrones detectados |
| `ai-specs/.commands/develop-{tipo}.md` | Patrones reales del codebase |
| `ai-specs/.commands/enrich-ticket.md` | Tracker + criterios del stack |
| `ai-specs/.commands/plan-{tipo}-ticket.md` | Patrones + estructura del proyecto |
| `.claude/commands/create-{tracker}-tickets.md` | Tracker + cloudId + idioma |
| `.claude/commands/menu.md` | Tipo de proyecto + tracker + nombre |
| `ai-specs/specs/base-standards.mdc` | Idiomas + naming del codebase |
| `ai-specs/specs/documentation-standards.mdc` | Stack + idioma |
| `ai-specs/specs/{tipo}-standards.mdc` | Stack completo + patrones reales |
| `ai-specs/specs/ui-design-system.mdc` | Theme files (solo si frontend) |

### Metadata

| Archivo | Descripción |
|---------|-------------|
| `.bootstrap-meta.json` | Versión, fecha, config del bootstrap |

---

Al terminar la verificación:

```
✅ Bootstrap V4.1 completado!

Resumen:
  Fase 0-2: Detección y perfil
  Fase 3-4: Archivos reusables
  Fase 5:   Archivos adaptados
  Fase 5b:  docs/ con contenido base
  Fase 6:   OpenSpec inicializado
  Fase 7:   Verificación OK

Próximos pasos:
  1. /menu — menú principal
  2. /generate-docs — completar documentación
  3. /opsx:onboard — tutorial guiado (15 min)
```

Opcional — limpiar archivos de bootstrap:
```bash
echo ".ai-internal/ mantenido para futuras re-ejecuciones"
```
