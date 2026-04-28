# Phase 0c — Preguntas, confirmación y guardado del perfil

> Sub-fase final de `phase-0-detect.md`. Asume que `phase-0a-mcps-tracker.md` y `phase-0b-codebase.md` ya fueron ejecutados.
> Pregunta solo lo que no se pudo inferir, muestra el resumen, pide confirmación y persiste el perfil + variables sed.

---

## FASE 1: Preguntar SOLO lo que no se puede inferir

Habiendo analizado el codebase, ahora preguntá ÚNICAMENTE lo que no pudiste determinar automáticamente.

**Regla**: Si podés inferirlo con >80% de confianza del codebase, NO lo preguntes. Confirmalo en el resumen del Paso 2.

### 1.0 — Determinar modo multi-target (multi-microservicio / multi-microfrontend)

> **Por qué**: cuando el proyecto tiene múltiples subproyectos independientes (microservicios, microfrontends, libs separadas), generar comandos genéricos por "rol" (frontend/backend) pierde especificidad. El **modo multi-target** genera un set de archivos por subproyecto (con su propio path, stack y comandos).

Calcular `MULTI_TARGET_CANDIDATE` con la lógica:

```
Sea N = subproject_count (de phase-0b 0.1c)
Sea front_count = cantidad de subprojects con SUBTYPE empezando en "frontend:" o "mobile:"
Sea back_count = cantidad de subprojects con SUBTYPE empezando en "backend:"
Sea other_count = N - front_count - back_count

MULTI_TARGET_CANDIDATE = true si:
  - N >= 3, O
  - N == 2 y NO es exactamente 1 frontend + 1 backend (ej: 2 backends, 2 frontends, 1 backend + 1 lib),
  - O cualquier other_count > 0 con N >= 2.

Caso 1+1 clásico (N==2, front_count==1, back_count==1) → MULTI_TARGET_CANDIDATE = false (mantener fullstack-clásico para backwards-compat).
Caso plano (N <= 1) → MULTI_TARGET_CANDIDATE = false.
```

**Si `MULTI_TARGET_CANDIDATE == true`**, preguntar con AskUserQuestion (single_select):

```
🎯 Detecté {N} subproyectos en este repo:
  • {path_1} ({SUBTYPE_1})
  • {path_2} ({SUBTYPE_2})
  ...

¿Cómo querés gestionarlos en el flujo de SDD?
```

Opciones:
- **"Multi-target — un set de comandos por subproyecto"** (recomendado para microservicios/microfrontends): genera `/develop-{slug}`, `/plan-{slug}-ticket` y `{slug}-standards.mdc` para cada subproyecto. Cada ticket elige un subproyecto target.
- **"Modo simple — un solo comando genérico"**: trata todo como un único proyecto (útil si los subproyectos son livianos o querés mantenerlo simple).

Guardar el resultado:

```
MULTI_TARGET_MODE = true | false
```

**Si MULTI_TARGET_MODE == true**, calcular un slug por cada subproyecto:

```
Para cada subproject:
  RAW = nombre_carpeta (ej: "auth-service", "payments-service", "shell")
  SLUG = lowercase + reemplazar _ y espacios por -
  Si hay colisiones → agregar índice numérico (auth-service, auth-service-2)

SUBPROJECT_SLUGS = lista ordenada de {path, slug, type, framework, ui_library, ...}
```

> **Si MULTI_TARGET_CANDIDATE == false** (proyecto plano o fullstack-clásico 1+1): saltar este paso. `MULTI_TARGET_MODE = false` por default.

### 1.1 — Determinar qué preguntar

Evaluá cada item:

| Item | Preguntar si... |
|------|----------------|
| Nombre del proyecto | No está claro en package.json o carpeta raíz |
| Framework/versión | No encontrado en package.json o equivalente |
| UI Library | No detectada en dependencias |
| Backend type | No hay archivos de API client claros |
| Auth method | No hay archivos de auth store claros |
| State management | No hay dependencias claras |
| Testing framework | No hay archivos de test ni devDependencies claras |
| **Idioma tickets** | **SIEMPRE — no se puede inferir del código** |
| **Figma** | Si es frontend y no hay evidencia clara |
| Estructura de carpetas | Si ls src/ fue ambiguo |
| **MCPs** | Si la detección del 0.0b fue "unknown" para alguno relevante |

### 1.1b — Si es re-ejecución, mostrar archivos modificados

Si `ESTADO_CONFIG.es_re_ejecucion == true` Y hay archivos en `archivos_modificados_manualmente`:

```
⚠️  CONFIGURACIÓN PREVIA DETECTADA (Bootstrap V{version_previa})

Estos archivos fueron modificados manualmente desde el último bootstrap:
  - ai-specs/specs/frontend-standards.mdc (editado hace 3 días)
  - CLAUDE.md (editado hace 1 día)

Opciones:
  🔄 Sobreescribir todo (se crean backups en .bootstrap-backup/)
  🛡️ Proteger modificados (solo sobreescribir los no editados + reusables)
  📋 Mostrar diff (ver qué cambió antes de decidir)
```

Usá **AskUserQuestion** (single_select): "Sobreescribir todo (con backup)" / "Proteger archivos editados" / "Mostrar diff primero"

Si elige diff: mostrar diff resumido de cada archivo modificado, luego re-preguntar.

Si elige proteger: marcar esos archivos como `SKIP` en el proceso de creación.

### 1.2 — Hacer preguntas agrupadas

Usá **AskUserQuestion** con TODAS las preguntas pendientes en UNA SOLA llamada. Máximo 5 preguntas. Antes de la pregunta, mostrá:

```
📋 Analicé el proyecto. Esto es lo que detecté:

✅ Framework: [lo que detectaste]
✅ Stack: [lo que detectaste]
✅ Estructura: [lo que detectaste]
✅ Jira: {workspace_name} (cloudId: {cloud_id}) — Proyecto: {project_key}
✅ Jira identity: MCP cloud (cuenta OAuth conectada)
✅ MCPs detectados: [Atlassian: ✅, GitHub: ✅/❌, Figma: ✅/❌]
✅ openspec: v[versión detectada]
[si re-ejecución: "🔄 Re-ejecución de bootstrap (V{version_previa} → V4)"]
[...]

❓ Solo necesito confirmar algunos datos que no pude inferir del código:
```

Las preguntas SIEMPRE incluidas (estas no se pueden inferir):

```
1. Idioma de tickets: ¿Los tickets van en español o inglés?

2. Diseño: ¿El equipo usa Figma? (Sí / No / Otro)
```

> **Nota**: La pregunta sobre sistema de tickets y cloudId ya no se hace aquí — se resolvió automáticamente en el paso 0.0c via MCP.

Preguntas opcionales (solo si no se pudo inferir del codebase):
```
3. [Solo si framework ambiguo]: ¿Confirmás que el framework principal es [X]?
4. [Solo si estructura ambigua]: ¿Cuál es la carpeta principal de código fuente?
5. [Solo si MCPs unknown]: ¿Tenés configurado el MCP de [GitHub/Figma]?
```

### 1.3 — Consolidar perfil final

Con las respuestas, completá el `PROYECTO_PERFIL` y procedé al Paso 2.

---

## FASE 2: Mostrar resumen y pedir confirmación

Antes de crear un solo archivo, mostrá este resumen:

```
🔍 PERFIL DEL PROYECTO DETECTADO

Proyecto:    [nombre]
Tipo:        [frontend | backend | fullstack | mobile | monorepo-fullstack]
Framework:   [nombre + versión] (o "ver subprojects" si monorepo)
Lenguaje:    [TypeScript/JavaScript/Python/etc]
UI Library:  [nombre o "N/A"]
Backend:     [tipo + env var URL]
Auth:        [método]
State:       [server state + auth state]
Forms:       [lib + validation] o "N/A"
Testing:     [framework o "no configurado"]
Tickets:     [Jira / Linear / GitHub Issues] + idioma
Jira:        MCP cloud (autenticado)
Diseño:      [Figma / Otro / No]
OpenSpec:    v[versión]
MCPs:        [lista de disponibles]
Modo:        [🆕 Primera instalación | 🔄 Re-ejecución (V{prev} → V4)]

📁 ARCHIVOS QUE VAN A CREARSE

Reusables (sin modificación):
  - .claude/commands/opsx/ (10 comandos)
  - ai-specs/.commands/explain.md
  - ai-specs/.commands/meta-prompt.md
  - ai-specs/.commands/commit.md
  - ai-specs/.commands/update-docs.md
  - ai-specs/.commands/review-pr.md
  - ai-specs/.commands/test-plan.md
  - ai-specs/.commands/evidence.md
  - ai-specs/.commands/generate-docs.md
  - ai-specs/.commands/release-to-main.md
  - ai-specs/.agents/product-strategy-analyst.md

Adaptados al proyecto:
  - CLAUDE.md [SKIP si protegido]
  - AGENTS.md [SKIP si protegido]
  - openspec/config.yaml
  - ai-specs/AI-WORKFLOW-PLAYBOOK.md
  - ai-specs/.agents/[tipo]-developer.md [SKIP si protegido]
  - ai-specs/.commands/develop-[tipo].md
  - ai-specs/.commands/enrich-ticket.md
  - ai-specs/.commands/plan-[tipo]-ticket.md
  - .claude/commands/create-[tracker]-tickets.md
  - .claude/commands/menu.md
  - ai-specs/specs/base-standards.mdc [SKIP si protegido]
  - ai-specs/specs/documentation-standards.mdc [SKIP si protegido]
  - ai-specs/specs/[tipo]-standards.mdc [SKIP si protegido]
  [+ ai-specs/specs/ui-design-system.mdc si es frontend con design system]

  {Si monorepo-fullstack — archivos ADICIONALES:}
  - ai-specs/.agents/frontend-developer.md [SKIP si protegido]
  - ai-specs/.agents/backend-developer.md [SKIP si protegido]
  - ai-specs/.commands/develop-frontend.md
  - ai-specs/.commands/develop-backend.md
  - ai-specs/.commands/plan-frontend-ticket.md
  - ai-specs/.commands/plan-backend-ticket.md
  - ai-specs/specs/frontend-standards.mdc [SKIP si protegido]
  - ai-specs/specs/backend-standards.mdc [SKIP si protegido]

Generados por openspec init (post-creación):
  - .claude/skills/openspec-*/ (10 skills — generados por openspec init)

Metadata:
  - .bootstrap-meta.json (tracking de versión)

Estructura /docs (generada con contenido base):
  - docs/README.md (índice + changelog)
  - docs/api/README.md (índice API + auth)
  - docs/evidence/README.md (convenciones de evidencia)
  - docs/assets/README.md (convenciones de diagramas)
  - docs/components/README.md (si frontend)

⚠️  NOTA: Si ya existe CLAUDE.md y no está protegido, se va a sobreescribir con la versión mejorada.
{Si hay archivos protegidos: "🛡️ Archivos protegidos (no se tocan): [lista]"}
{Si hay backups: "💾 Backups en: .bootstrap-backup/[fecha]/"}

¿Procedemos con esta configuración?
```

Usá **AskUserQuestion** (single_select): "Sí, crear todo" / "Espera, necesito corregir algo".

Si elige corregir: preguntá qué cambiar, actualizá el perfil, mostrá el resumen de nuevo.

---

## GUARDAR ESTADO (obligatorio antes de continuar)

Al terminar la Fase 2, guardá el perfil completo:

```bash
mkdir -p .ai-internal
```

Crear `.ai-internal/project-profile.md` con TODOS los datos reales del PROYECTO_PERFIL:

```
# Proyecto: {nombre}
# Tipo: {tipo}
# Multi Target Mode: {MULTI_TARGET_MODE}
# Subproject Slugs: {coma-separados — solo si Multi Target Mode == true, ej: "auth-service,payments-service,shell"}
# Framework: {framework} {version}
# Lenguaje: {lenguaje}
# UI Library: {ui_library}
# Backend: {backend_type}
# HTTP Client: {http_client}
# Server State: {server_state}
# Auth State: {auth_state}
# Form Lib: {form_lib}
# Validation Lib: {validation_lib}
# Testing: {testing_framework}
# Tracker: {tracker}
# Tracker CloudId: {cloud_id}
# Tracker Project Key: {project_key}
# Jira Identity: {jira_identity}
# Jira Statuses: {jira_statuses}
# Jira Statuses Missing: {jira_statuses_missing}
# Notion Database ID: {notion_database_id}
# Notion Status Property: {notion_status_property}
# Notion Statuses: {notion_statuses}
# Dev Branch: {dev_branch}
# Idioma técnico: {idioma_tecnico}
# Idioma tickets: {idioma_tickets}
# Idioma UI: {idioma_ui}
# Figma: {tiene_figma}
# MCP Atlassian: {status} (prefix: {prefix})
# MCP GitHub: {status} (prefix: {prefix})
# MCP Figma: {status} (prefix: {prefix})
# Estructura carpetas: {breve}
# Patrón componentes: {patron}
# Patrón hooks: {patron}
# Patrón API: {patron}
# Env vars: {lista}
# Archivos clave: {lista}
# OpenSpec version: {version}
# Es re-ejecución: {bool}
# Archivos protegidos: {lista}

{Si tipo == monorepo-fullstack Y MULTI_TARGET_MODE == false, agregar sección de subprojects clásica (1 frontend + 1 backend):}

## Subprojects

### frontend
**Path**: {path_del_subdirectorio_frontend}
**Type**: frontend
**Framework**: {framework_frontend} {version}
**UI Library**: {ui_library}
**HTTP Client**: {http_client}
**Server State**: {server_state}
**Auth State**: {auth_state}
**Form Lib**: {form_lib}
**Validation Lib**: {validation_lib}
**Testing**: {testing_frontend}
**Estructura carpetas**: {breve}
**Patrón componentes**: {patron}
**Patrón hooks**: {patron}
**Env vars**: {lista_frontend}

### backend
**Path**: {path_del_subdirectorio_backend}
**Type**: backend
**Framework**: {framework_backend} {version}
**ORM**: {orm}
**Database**: {database}
**Auth Method**: {auth_method}
**Validation Lib**: {validation_lib_back}
**Testing**: {testing_backend}
**Estructura carpetas**: {breve}
**Patrón API**: {patron}
**Env vars**: {lista_backend}

{Si MULTI_TARGET_MODE == true, agregar una sección por cada subproyecto detectado, usando el slug como header:}

## Subprojects

### {slug_subproject_1}
**Path**: {path_relativo}
**Type**: {frontend | backend | mobile | shared-lib | infra | unknown}
**Framework**: {framework + versión}
**UI Library**: {ui_library_si_aplica}
**HTTP Client**: {http_client_si_aplica}
**Server State**: {server_state_si_aplica}
**Auth State**: {auth_state_si_aplica}
**Form Lib**: {form_lib_si_aplica}
**Validation Lib**: {validation_lib}
**ORM**: {orm_si_aplica}
**Database**: {database_si_aplica}
**Auth Method**: {auth_method_si_aplica}
**Testing**: {testing_framework}
**Estructura carpetas**: {breve}
**Patrones**: {patrones_relevantes}
**Env vars**: {lista_de_keys}

### {slug_subproject_2}
{misma estructura, datos del agent que analizó este subproject}

{...repetir por cada subproject del array MONOREPO_DETECTION.subprojects}
```

> Reemplazá TODOS los `{...}` con datos reales antes de escribir.

Después de guardar el project-profile, generar el archivo de variables para sed:

```bash
# Generar project-vars.sh desde project-profile.md
# Este archivo se usa en Fase 5 para reemplazar placeholders en templates con sed

NOMBRE=$(grep "^# Proyecto:" .ai-internal/project-profile.md | sed 's/^# Proyecto: //')
TIPO=$(grep "^# Tipo:" .ai-internal/project-profile.md | sed 's/^# Tipo: //')
FRAMEWORK=$(grep "^# Framework:" .ai-internal/project-profile.md | sed 's/^# Framework: //' | awk '{print $1}')
TRACKER=$(grep "^# Tracker:" .ai-internal/project-profile.md | sed 's/^# Tracker: //')
CLOUD_ID=$(grep "^# Tracker CloudId:" .ai-internal/project-profile.md | sed 's/^# Tracker CloudId: //')
PROJECT_KEY=$(grep "^# Tracker Project Key:" .ai-internal/project-profile.md | sed 's/^# Tracker Project Key: //')
NOTION_DB_ID=$(grep "^# Notion Database ID:" .ai-internal/project-profile.md | sed 's/^# Notion Database ID: //')
IDIOMA_TECNICO=$(grep "^# Idioma técnico:" .ai-internal/project-profile.md | sed 's/^# Idioma técnico: //')
IDIOMA_TICKETS=$(grep "^# Idioma tickets:" .ai-internal/project-profile.md | sed 's/^# Idioma tickets: //')

# Criterio específico del proyecto (para enrich-ticket)
# Se genera como una línea que describe qué verificar según el tipo de proyecto
if [ "$TIPO" = "frontend" ] || [ "$TIPO" = "fullstack" ] || [ "$TIPO" = "monorepo-fullstack" ]; then
  CRITERIO_PROYECTO="Diseño/Figma referenciado si aplica, contratos de API documentados"
elif [ "$TIPO" = "backend" ]; then
  CRITERIO_PROYECTO="Contratos de API documentados"
elif [ "$TIPO" = "mobile" ]; then
  CRITERIO_PROYECTO="Plataformas target especificadas (iOS/Android)"
else
  CRITERIO_PROYECTO="Requisitos técnicos completos"
fi

MULTI_TARGET_MODE=$(grep "^# Multi Target Mode:" .ai-internal/project-profile.md | sed 's/^# Multi Target Mode: //')
SUBPROJECT_SLUGS=$(grep "^# Subproject Slugs:" .ai-internal/project-profile.md | sed 's/^# Subproject Slugs: //')

cat > .ai-internal/project-vars.sh << VARSEOF
# Auto-generated from project-profile.md — do not edit manually
# Used by phase-2 templates for sed replacement

SDD_NOMBRE="$NOMBRE"
SDD_TIPO="$TIPO"
SDD_FRAMEWORK="$FRAMEWORK"
SDD_TRACKER="$TRACKER"
SDD_CLOUD_ID="$CLOUD_ID"
SDD_PROJECT_KEY="$PROJECT_KEY"
SDD_NOTION_DATABASE_ID="$NOTION_DB_ID"
SDD_IDIOMA_TECNICO="$IDIOMA_TECNICO"
SDD_IDIOMA_TICKETS="$IDIOMA_TICKETS"
SDD_CRITERIO_PROYECTO="$CRITERIO_PROYECTO"
SDD_MULTI_TARGET_MODE="$MULTI_TARGET_MODE"
SDD_SUBPROJECT_SLUGS="$SUBPROJECT_SLUGS"
VARSEOF

# Si multi-target, agregar bloque iterativo: una variable por subproject
# con su path, slug, tipo, framework. Phase 2 itera sobre estas variables.
if [ "$MULTI_TARGET_MODE" = "true" ] && [ -n "$SUBPROJECT_SLUGS" ]; then
  echo "" >> .ai-internal/project-vars.sh
  echo "# Multi-target subprojects (iterables — un bloque por subproyecto)" >> .ai-internal/project-vars.sh
  IFS=',' read -ra SLUG_ARRAY <<< "$SUBPROJECT_SLUGS"
  for SLUG in "${SLUG_ARRAY[@]}"; do
    # Para cada slug, leer su sección desde project-profile.md "## Subprojects"
    # y exportar variables. El project-profile tiene secciones tipo:
    #   ### {slug}
    #   **Path**: {path}
    #   **Framework**: {framework}
    #   **Type**: {type}
    SLUG_UPPER=$(echo "$SLUG" | tr '[:lower:]-' '[:upper:]_')
    SUB_PATH=$(awk -v s="### $SLUG" '$0==s{f=1;next} f && /^### /{exit} f && /^\*\*Path\*\*:/{sub(/^\*\*Path\*\*: */,""); print; exit}' .ai-internal/project-profile.md)
    SUB_FRAMEWORK=$(awk -v s="### $SLUG" '$0==s{f=1;next} f && /^### /{exit} f && /^\*\*Framework\*\*:/{sub(/^\*\*Framework\*\*: */,""); print; exit}' .ai-internal/project-profile.md)
    SUB_TYPE=$(awk -v s="### $SLUG" '$0==s{f=1;next} f && /^### /{exit} f && /^\*\*Type\*\*:/{sub(/^\*\*Type\*\*: */,""); print; exit}' .ai-internal/project-profile.md)
    {
      echo "SDD_SUB_${SLUG_UPPER}_SLUG=\"$SLUG\""
      echo "SDD_SUB_${SLUG_UPPER}_PATH=\"$SUB_PATH\""
      echo "SDD_SUB_${SLUG_UPPER}_FRAMEWORK=\"$SUB_FRAMEWORK\""
      echo "SDD_SUB_${SLUG_UPPER}_TYPE=\"$SUB_TYPE\""
    } >> .ai-internal/project-vars.sh
  done
fi

echo "✅ project-vars.sh generado"
```

Mostrá:
```
✅ Fase 0-2 completada. Perfil guardado.
   Siguiente: ejecutá /bootstrap para Fase 3-4 (archivos reusables)
```
