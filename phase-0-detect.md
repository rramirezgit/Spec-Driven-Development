# Bootstrap Prompt V4.1 — AI Workflow Setup

> **Changelog V4 → V4.1**:
> - Nuevo comando `/evidence` — evidencia de completitud + documentación cross-team en `/docs`
> - Nuevo comando `/generate-docs` — documentación completa del proyecto (standalone, iterativo)
> - `/commit` modificado — evidence check con warning antes de commitear
> - Templates de docs centralizados en `documentation-standards.mdc` (fuente única de verdad)
> - Cross-references docs/ ↔ ai-specs/ para evitar duplicación de contenido
> - Fase 3 crea estructura `/docs` + Fase 5b genera contenido base
> - `/doc-ticket` eliminado — absorbido como `/evidence --docs-only`
> - Opción 8 del menú eliminada — evidencia integrada en flujos 1/2/4
> - Fase 7 verifica estructura `/docs` y comandos de evidencia
>
> **Changelog V3 → V4**:
> - Fase 0: Validación de versión mínima de openspec + detección de MCPs disponibles
> - Fase 0.5 nueva: Modo incremental — backup y merge inteligente si ya existe configuración
> - Fase 4/6: Eliminada creación redundante de SKILL.md (ahora solo openspec init los genera)
> - Fase 5: Validación de calidad post-generación para archivos adaptados
> - Fase 7: Regex de verificación mejorado (sin falsos positivos por `{` legítimos)
> - Fase 7: Archivo `.bootstrap-meta.json` para tracking de versión y re-ejecuciones
> - General: Checkpoints de contexto entre fases para mitigar pérdida en ventanas largas
>
> **Prerequisitos**:
> - `npm install -g openspec-cli@^0.5.0` — debe estar instalado globalmente **antes** de correr este prompt (versión mínima 0.5.0)
> - `openspec --version` debe retornar una versión válida ≥ 0.5.0
> - MCPs instalados y autenticados: Atlassian, GitHub, Figma (si aplica), Playwright (si aplica)
> - Ejecutar desde la raíz del proyecto en Claude Code
>
> **Cómo usar**:
> 1. Instalá openspec: `npm install -g openspec-cli`
> 2. Abrí Claude Code en el proyecto
> 3. Corré `/init` primero (si no hay CLAUDE.md todavía)
> 4. Pegá el contenido desde "EL PROMPT" como mensaje

---


## EL PROMPT

---

Necesito que configures un sistema completo de flujos de trabajo asistidos por IA en este proyecto.

Seguí estas instrucciones **exactamente y en orden**. No omitas pasos. No improvises estructura. No crees archivos que no estén indicados.

---

## FASE 0: Leer el codebase antes de hacer cualquier pregunta

**No hagas ninguna pregunta todavía.** Primero vas a explorar el proyecto para inferir todo lo que puedas automáticamente.

### 0.0 — Verificar que openspec está instalado y es compatible

```bash
openspec --version 2>&1 || echo "NOT_FOUND"
```

**Si el comando falla o no existe → DETENER completamente** y mostrar:

```
❌ openspec-cli no está instalado o no está en el PATH.

Instalalo con:
  npm install -g openspec-cli

Verificá con:
  openspec --version

Una vez instalado, volvé a correr este prompt.
```

**Si el comando retorna una versión < 0.5.0 → DETENER completamente** y mostrar:

```
❌ openspec-cli versión [VERSION_DETECTADA] es incompatible.
Este prompt requiere openspec-cli >= 0.5.0.

Actualizá con:
  npm install -g openspec-cli@latest

Verificá con:
  openspec --version

Una vez actualizado, volvé a correr este prompt.
```

**No continúes ningún paso siguiente hasta que openspec esté disponible y sea compatible.**

---

### 0.0b — Detectar MCPs disponibles

```bash
# Intentar detectar MCPs disponibles en el entorno
echo "=== MCP DETECTION ==="

# Jira / Atlassian
(claude mcp list 2>/dev/null || echo "") | grep -i "atlassian\|jira" && echo "MCP_ATLASSIAN=available" || echo "MCP_ATLASSIAN=not_found"

# GitHub
(claude mcp list 2>/dev/null || echo "") | grep -i "github" && echo "MCP_GITHUB=available" || echo "MCP_GITHUB=not_found"

# Figma
(claude mcp list 2>/dev/null || echo "") | grep -i "figma" && echo "MCP_FIGMA=available" || echo "MCP_FIGMA=not_found"

# Playwright
(claude mcp list 2>/dev/null || echo "") | grep -i "playwright" && echo "MCP_PLAYWRIGHT=available" || echo "MCP_PLAYWRIGHT=not_found"

# gh CLI (para PRs)
gh --version 2>/dev/null && echo "GH_CLI=available" || echo "GH_CLI=not_found"
```

Construí internamente:

```
MCPS_DISPONIBLES:
  atlassian: [available | not_found]
  github: [available | not_found]
  figma: [available | not_found]
  playwright: [available | not_found]
  gh_cli: [available | not_found]

  # Nombres reales de tools MCP detectados (para usar en comandos)
  atlassian_prefix: [el prefijo real detectado, ej: "mcp__atlassian__" o "Atlassian:"]
  github_prefix: [el prefijo real]
  figma_prefix: [el prefijo real]
```

> **Nota**: Si `claude mcp list` no está disponible, no fallar. Marcar todos como "unknown" y preguntar en Fase 1.

---

### 0.1 — Verificar si existe CLAUDE.md

```bash
test -f CLAUDE.md && echo "EXISTS" || echo "NOT_FOUND"
```

- **Si existe**: Leelo completamente. Ya tenés contexto del proyecto.
- **Si no existe**: Continuá con el paso 0.2.

### 0.1b — Detectar configuración previa (modo incremental)

```bash
echo "=== EXISTING CONFIG DETECTION ==="
test -f .bootstrap-meta.json && echo "BOOTSTRAP_META=EXISTS" && cat .bootstrap-meta.json || echo "BOOTSTRAP_META=NOT_FOUND"
test -d .claude/commands/opsx && echo "OPSX_COMMANDS=EXISTS" || echo "OPSX_COMMANDS=NOT_FOUND"
test -d ai-specs && echo "AI_SPECS=EXISTS" || echo "AI_SPECS=NOT_FOUND"
test -f openspec/config.yaml && echo "OPENSPEC_CONFIG=EXISTS" || echo "OPENSPEC_CONFIG=NOT_FOUND"

# Detectar archivos que fueron editados manualmente (modificados después del bootstrap)
if [ -f .bootstrap-meta.json ]; then
  BOOTSTRAP_DATE=$(cat .bootstrap-meta.json | grep -o '"created_at":"[^"]*"' | cut -d'"' -f4)
  echo "=== ARCHIVOS MODIFICADOS POST-BOOTSTRAP ==="
  find ai-specs/specs/ -name "*.mdc" -newer .bootstrap-meta.json 2>/dev/null
  find ai-specs/.agents/ -name "*.md" -newer .bootstrap-meta.json 2>/dev/null
  test -f CLAUDE.md && [ CLAUDE.md -nt .bootstrap-meta.json ] && echo "CLAUDE.md (modified)"
  test -f AGENTS.md && [ AGENTS.md -nt .bootstrap-meta.json ] && echo "AGENTS.md (modified)"
fi
```

Construí internamente:

```
ESTADO_CONFIG:
  es_re_ejecucion: [true | false]  # true si .bootstrap-meta.json existe
  version_previa: [versión del bootstrap anterior o "none"]
  archivos_modificados_manualmente: [lista]
  tiene_opsx: [true | false]
  tiene_ai_specs: [true | false]
  tiene_openspec_config: [true | false]
```

**Si `es_re_ejecucion == true`**:
- Los archivos **reusables** (opsx commands, skills, reusable commands) SIEMPRE se sobreescriben — son idénticos en cualquier proyecto y pueden tener mejoras.
- Los archivos **adaptados** que fueron modificados manualmente → crear backup y mostrar diff al usuario antes de sobreescribir.
- Los archivos **adaptados** que NO fueron modificados → sobreescribir directamente.

---

### 0.2 — Exploración automática del codebase

Ejecutá estos comandos en secuencia y procesá la salida:

```bash
# Estructura raíz
ls -la

# Package.json (fuente principal de verdad para el stack)
cat package.json 2>/dev/null || cat build.gradle 2>/dev/null || cat pom.xml 2>/dev/null || cat Cargo.toml 2>/dev/null || cat requirements.txt 2>/dev/null || cat go.mod 2>/dev/null

# Estructura src
ls src/ 2>/dev/null || ls app/ 2>/dev/null || ls lib/ 2>/dev/null || ls internal/ 2>/dev/null

# Archivos de configuración clave
ls *.config.* *.json *.yaml *.yml *.toml 2>/dev/null | head -20

# Variables de entorno (solo keys, nunca valores)
cat .env.example 2>/dev/null || cat .env.local.example 2>/dev/null || cat .env.template 2>/dev/null

# Detectar /docs existente
test -d docs && echo "DOCS_DIR=EXISTS" || echo "DOCS_DIR=NOT_FOUND"
ls docs/ 2>/dev/null | head -20
ls docs/evidence/ 2>/dev/null | head -10
ls docs/api/ 2>/dev/null | head -10

# Detectar tipo de proyecto
test -f next.config.js -o -f next.config.ts && echo "NEXTJS"
test -f vite.config.ts -o -f vite.config.js && echo "VITE"
test -f expo.json -o -f app.json && echo "EXPO"
test -f nest-cli.json && echo "NESTJS"
test -f manage.py && echo "DJANGO"
test -f artisan && echo "LARAVEL"
test -f go.mod && echo "GOLANG"
test -f Cargo.toml && echo "RUST"
```

### 0.3 — Explorar estructura de carpetas relevantes

Según el tipo de proyecto detectado, explorá en profundidad:

```bash
# Si tiene src/
find src -maxdepth 3 -type d 2>/dev/null

# Si tiene app/ (Next.js App Router)
find app -maxdepth 3 -type d 2>/dev/null

# Buscar patrones de archivos existentes
find . -maxdepth 4 -name "*.service.ts" -o -name "*.hook.ts" -o -name "use-*.ts" -o -name "*.store.ts" -o -name "axiosInstance*" -o -name "api.ts" -o -name "httpClient*" 2>/dev/null | grep -v node_modules | head -20

# Buscar tests existentes para entender el framework
find . -maxdepth 4 -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | grep -v node_modules | head -10

# Buscar archivos de tema/diseño
find . -maxdepth 4 -name "theme.*" -o -name "*theme*" 2>/dev/null | grep -v node_modules | head -10
```

### 0.4 — Leer archivos clave del proyecto

Leé estos archivos si existen (SIN mostrarlos al usuario — solo procesarlos internamente):

```bash
# Configuraciones de TypeScript/linting
cat tsconfig.json 2>/dev/null
cat .eslintrc* 2>/dev/null || cat eslint.config.* 2>/dev/null

# Archivo de cliente HTTP (si existe)
cat $(find . -maxdepth 5 -name "axiosInstance*" -o -name "httpClient*" -o -name "api-client*" 2>/dev/null | grep -v node_modules | head -1) 2>/dev/null

# Store de auth (si existe)
cat $(find . -maxdepth 5 -name "*auth*store*" -o -name "*auth*.zustand*" 2>/dev/null | grep -v node_modules | head -1) 2>/dev/null

# Un ejemplo de hook de datos (si existe)
find . -maxdepth 5 -name "use-*.ts" -o -name "use-*.tsx" 2>/dev/null | grep -v node_modules | head -3
```

### 0.5 — Construir el perfil del proyecto

Con toda la información recopilada, construí internamente este perfil:

```
PROYECTO_PERFIL:
  nombre: [inferir del package.json "name" o nombre de carpeta raíz]
  tipo: [frontend | backend | fullstack | mobile | monorepo]
  plataforma: [web | mobile | api | mixed]
  framework_principal: [nombre + versión]
  lenguaje: [TypeScript | JavaScript | Python | Go | Java | Rust | etc]
  ui_library: [MUI | Tailwind | ChakraUI | shadcn | ninguna | etc] (si aplica)
  http_client: [axios | fetch | ky | got | etc]
  server_state: [SWR | React Query | RTK Query | ninguno | etc] (si aplica)
  auth_state: [Zustand | Redux | Context | Passport | etc]
  form_lib: [React Hook Form | Formik | ninguna | etc] (si aplica)
  validation_lib: [Zod | Yup | Joi | class-validator | etc]
  testing_framework: [Playwright | Cypress | Jest | Vitest | pytest | ninguno | etc]
  tiene_figma: [probable si hay MUI/Tailwind y es frontend]
  tiene_jira: [desconocido — preguntar]
  estructura_carpetas: [descripcion breve]
  patron_componentes: [inferido de archivos existentes]
  patron_hooks: [inferido de archivos existentes]
  patron_api: [inferido de cliente HTTP existente]
  env_vars_detectadas: [lista de keys del .env.example]
  archivos_clave: [lista de archivos importantes detectados]
  openspec_version: [versión detectada en 0.0]
  mcps_disponibles: [del paso 0.0b]
  estado_config: [del paso 0.1b]
  tiene_docs: [true | false]
  docs_estructura: [descripción si existe]
```

---

## FASE 1: Preguntar SOLO lo que no se puede inferir

Habiendo analizado el codebase, ahora preguntá ÚNICAMENTE lo que no pudiste determinar automáticamente.

**Regla**: Si podés inferirlo con >80% de confianza del codebase, NO lo preguntes. Confirmalo en el resumen del Paso 2.

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
| **Jira cloudId** | **SIEMPRE — no se puede inferir del código** |
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
✅ MCPs detectados: [Atlassian: ✅/❌, GitHub: ✅/❌, Figma: ✅/❌]
✅ openspec: v[versión detectada]
[si re-ejecución: "🔄 Re-ejecución de bootstrap (V{version_previa} → V4)"]
[...]

❓ Solo necesito confirmar algunos datos que no pude inferir del código:
```

Las preguntas SIEMPRE incluidas (estas no se pueden inferir):

```
1. Sistema de tickets: ¿Usás Jira, Linear, GitHub Issues u otro?
   - Si es Jira: ¿Cuál es el cloudId del workspace Atlassian?
   - (Lo encontrás en: Jira Settings → Products → Jira Software configuration)

2. Idioma de tickets: ¿Los tickets van en español o inglés?

3. Diseño: ¿El equipo usa Figma? (Sí / No / Otro)
```

Preguntas opcionales (solo si no se pudo inferir del codebase):
```
4. [Solo si framework ambiguo]: ¿Confirmás que el framework principal es [X]?
5. [Solo si estructura ambigua]: ¿Cuál es la carpeta principal de código fuente?
6. [Solo si MCPs unknown]: ¿Tenés configurado el MCP de [Atlassian/GitHub/Figma]?
```

### 1.3 — Consolidar perfil final

Con las respuestas, completá el `PROYECTO_PERFIL` y procedé al Paso 2.

---

## FASE 2: Mostrar resumen y pedir confirmación

Antes de crear un solo archivo, mostrá este resumen:

```
🔍 PERFIL DEL PROYECTO DETECTADO

Proyecto:    [nombre]
Tipo:        [frontend | backend | fullstack | mobile]
Framework:   [nombre + versión]
Lenguaje:    [TypeScript/JavaScript/Python/etc]
UI Library:  [nombre o "N/A"]
Backend:     [tipo + env var URL]
Auth:        [método]
State:       [server state + auth state]
Forms:       [lib + validation] o "N/A"
Testing:     [framework o "no configurado"]
Tickets:     [Jira / Linear / GitHub Issues] + idioma
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
```

> Reemplazá TODOS los `{...}` con datos reales antes de escribir.

Mostrá:
```
✅ Fase 0-2 completada. Perfil guardado.
   Siguiente: ejecutá /bootstrap para Fase 3-4 (archivos reusables)
```
