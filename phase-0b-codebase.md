# Phase 0b — Exploración del codebase y construcción de perfil

> Sub-fase de `phase-0-detect.md`. Asume que `phase-0a-mcps-tracker.md` ya fue ejecutado.
> Detecta CLAUDE.md previo, configuración de bootstrap previa, monorepo, stack del proyecto y construye `PROYECTO_PERFIL`.
> **Cargá y ejecutá este archivo SEGUNDO**, después de `phase-0a-mcps-tracker.md` y antes de `phase-0c-confirm.md`.

---

## 0.1 — Verificar si existe CLAUDE.md

```bash
test -f CLAUDE.md && echo "EXISTS" || echo "NOT_FOUND"
```

- **Si existe**: Leelo completamente. Ya tenés contexto del proyecto.
- **Si no existe**: Continuá con el paso 0.2.

## 0.1b — Detectar configuración previa (modo incremental)

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

## 0.1c — Detectar estructura monorepo (front + back en subdirectorios)

> **Por qué**: Si el proyecto tiene frontend y backend en carpetas separadas (ej: `app-front/` y `app-back/`),
> necesitamos analizar cada subdirectorio independientemente y generar agents/standards para ambos.

```bash
echo "=== MONOREPO DETECTION ==="

# Buscar subdirectorios que tengan su propio package.json, requirements.txt, go.mod, etc.
SUBPROJECTS=""
for dir in */; do
  dir_name="${dir%/}"
  # Ignorar directorios de infraestructura/config
  case "$dir_name" in
    node_modules|.git|.ai-internal|ai-specs|docs|openspec|.claude|.bootstrap-backup|dist|build|coverage) continue ;;
  esac

  if [ -f "$dir/package.json" ] || [ -f "$dir/requirements.txt" ] || [ -f "$dir/go.mod" ] || [ -f "$dir/Cargo.toml" ] || [ -f "$dir/pom.xml" ]; then
    # Detectar tipo de cada subdirectorio
    SUBTYPE="unknown"
    if [ -f "$dir/next.config.js" ] || [ -f "$dir/next.config.ts" ] || [ -f "$dir/next.config.mjs" ]; then
      SUBTYPE="frontend:nextjs"
    elif [ -f "$dir/vite.config.ts" ] || [ -f "$dir/vite.config.js" ]; then
      SUBTYPE="frontend:vite"
    elif [ -f "$dir/expo.json" ] || [ -f "$dir/app.json" ]; then
      SUBTYPE="mobile:expo"
    elif [ -f "$dir/nest-cli.json" ]; then
      SUBTYPE="backend:nestjs"
    elif [ -f "$dir/manage.py" ]; then
      SUBTYPE="backend:django"
    elif [ -f "$dir/artisan" ]; then
      SUBTYPE="backend:laravel"
    elif [ -f "$dir/go.mod" ]; then
      SUBTYPE="backend:go"
    elif [ -f "$dir/Cargo.toml" ]; then
      SUBTYPE="backend:rust"
    elif [ -f "$dir/package.json" ]; then
      # Heurístico: si tiene react/vue/angular → frontend, si tiene express/fastify/koa → backend
      if grep -q '"react"\|"vue"\|"@angular/core"\|"next"\|"nuxt"\|"svelte"' "$dir/package.json" 2>/dev/null; then
        SUBTYPE="frontend:react"
      elif grep -q '"express"\|"fastify"\|"koa"\|"@nestjs/core"\|"hapi"' "$dir/package.json" 2>/dev/null; then
        SUBTYPE="backend:node"
      fi
    fi
    echo "SUBPROJECT=$dir_name|$SUBTYPE"
    SUBPROJECTS="$SUBPROJECTS $dir_name"
  fi
done

# Contar subproyectos detectados
SUBPROJECT_COUNT=$(echo "$SUBPROJECTS" | wc -w | tr -d ' ')
echo "SUBPROJECT_COUNT=$SUBPROJECT_COUNT"
```

Construí internamente:

```
MONOREPO_DETECTION:
  subproject_count: [0 | 1 | 2+]
  subprojects: [lista de {path, tipo_detectado}]
  es_monorepo: [true si subproject_count >= 2 Y al menos uno es frontend Y al menos uno es backend]
```

**Si `es_monorepo == true`**:
- Marcar `tipo: monorepo-fullstack`
- **Spawn N agents Explore en paralelo, uno por cada subproyecto detectado**. La lista viene de `MONOREPO_DETECTION.subprojects`. Esto escala automáticamente: 2 subprojects → 2 agents, 5 subprojects (ej. microservicios) → 5 agents.
- **CRÍTICO**: enviar **todas** las invocaciones de Agent en **un único mensaje** con múltiples tool uses para que se ejecuten realmente en paralelo. Si las mandás secuenciales, se pierde la ventaja de tiempo.

  Para cada subproyecto, usar `Agent` tool con `subagent_type: "Explore"` y prompt específico según su tipo detectado:

  ```
  Si SUBTYPE empieza con "frontend:" o "mobile:":
    "Analizá el subdirectorio {path}/ (tipo detectado: {SUBTYPE}):
      - Lee {path}/package.json completo
      - Detectá: framework + versión exacta, UI library, state management,
        HTTP client, testing framework, form lib, validation lib
      - Explorá estructura de carpetas (src/, app/, components/, hooks/, etc.)
      - Leé archivos clave: tsconfig, theme/design tokens, auth store, 1-2
        ejemplos de hook/component
      - Identificá patrón de organización (feature-based, layer-based, etc.)
      - Retorná resumen estructurado con todos los datos detectados.
      Reportá en menos de 400 palabras."

  Si SUBTYPE empieza con "backend:":
    "Analizá el subdirectorio {path}/ (tipo detectado: {SUBTYPE}):
      - Lee {path}/package.json (o requirements.txt / go.mod / pom.xml) completo
      - Detectá: framework + versión, ORM, database, auth method, testing,
        validation lib, HTTP layer (REST/GraphQL/gRPC)
      - Explorá estructura (controllers/services/routes/handlers/models)
      - Leé entry point (main.ts/app.py/main.go), 1 controller + 1 service
        de ejemplo, config DB
      - Identificá patrón (layered, hexagonal, DDD, MVC simple, etc.)
      - Retorná resumen estructurado. Menos de 400 palabras."

  Si SUBTYPE es "unknown" o algo distinto (shared lib, infra, tooling):
    "Analizá el subdirectorio {path}/ (tipo: indeterminado):
      - Lee package manifest principal
      - Determiná qué hace este subproyecto (lib compartida, scripts, infra,
        documentación, otra cosa)
      - Reportá: rol del subproyecto, principales dependencias, si exporta
        algo público o es interno. Menos de 250 palabras."
  ```

- Los resultados de los N agents se consolidan en el perfil extendido (paso 0.5),
  bajo `## Subprojects` con una sub-sección por cada uno.
- Los pasos 0.2, 0.3, 0.4 se ejecutan **igualmente para la raíz** para complementar
  con datos que los agents no cubren (env vars, dev branch, /docs/, openspec).

---

**Si `es_monorepo == false`**: ir a la sección 0.1d (team analysis del proyecto plano) y luego a 0.2.

---

## 0.1d — Team de análisis para proyectos planos

> Cuando NO hay monorepo (proyecto en una sola raíz), igual usamos un team de
> Explore agents para análisis profundo y paralelo. Cada agent tiene un foco
> distinto, no se pisan, y el resultado consolidado da un perfil mucho más rico
> que el bash secuencial.

**Si `es_monorepo == false`**, lanzar **3 agents Explore en paralelo** con focos
complementarios:

> **CRÍTICO**: las 3 invocaciones de `Agent` deben ir en **un único mensaje** con
> múltiples tool uses (un bloque `Agent` por cada uno). Si las mandás secuenciales
> Claude las ejecuta una tras otra y perdés ~3x de tiempo.

```
Agent 1 — Stack & Dependencies (subagent_type: Explore):
  "Analizá el stack del proyecto en la raíz:
   - Lee el manifest principal (package.json / requirements.txt / go.mod /
     pom.xml / Cargo.toml). Lista TODAS las deps directas y devDeps.
   - Detectá con versión exacta: framework principal, lenguaje, build tool,
     package manager, UI library (si aplica), HTTP client, server state lib,
     auth state lib, form lib, validation lib, testing framework, ORM (si aplica),
     database driver (si aplica).
   - Lee tsconfig.json, .eslintrc / eslint.config.*, prettier config, .nvmrc.
   - Reportá un resumen estructurado en formato:
       framework_principal, lenguaje, build_tool, package_manager,
       ui_library, http_client, server_state, auth_state, form_lib,
       validation_lib, testing_framework, orm, database, type_checking_strict.
   Menos de 350 palabras."

Agent 2 — Arquitectura & Patrones (subagent_type: Explore):
  "Analizá la arquitectura del codebase en la raíz:
   - Mapeá la estructura de directorios (src/, app/, lib/, internal/,
     controllers/, services/, components/, hooks/, etc.) — máximo 3 niveles
     de profundidad, ignorando node_modules / dist / build / .git.
   - Identificá el patrón de organización: feature-based, layer-based,
     domain-driven, hexagonal, MVC, otro.
   - Leé 2-3 archivos representativos de los tipos clave: un service,
     un controller/handler, un hook, un component, un store/state.
   - Detectá naming conventions (kebab-case / camelCase / PascalCase,
     prefijos como use-/get-/Use, sufijos .service./.hook./.store.).
   - Identificá cliente HTTP/API: leé axiosInstance.* / httpClient.* /
     api-client.* si existen.
   - Reportá: estructura_carpetas (resumen breve),
     patron_organizacion, patron_componentes, patron_hooks, patron_api,
     naming_conventions. Menos de 400 palabras."

Agent 3 — Calidad & Testing (subagent_type: Explore):
  "Analizá la calidad y setup de testing del proyecto:
   - Buscá archivos de test (*.test.*, *.spec.*, __tests__/, e2e/, integration/).
     Reportá cantidad por tipo (unit/integration/e2e) y si están al lado del
     source o en carpetas separadas.
   - Detectá testing framework (Jest, Vitest, Mocha, Playwright, Cypress,
     pytest, go test, etc.) leyendo configs y devDeps.
   - Detectá CI: .github/workflows/, .gitlab-ci.yml, circle.yml, jenkins,
     bitbucket-pipelines.
   - Linting/formatting: confirmá si eslint/prettier/biome/ruff/black están
     activos y configurados.
   - Type checking: si TypeScript, mirá strict mode en tsconfig. Si Python,
     mirá mypy/pyright config.
   - Estimá madurez de tests: 'sin tests' / 'esqueleto' / 'cobertura parcial' /
     'cobertura amplia' (basado en ratio archivos de test vs source).
   - Reportá: testing_framework, test_count_breakdown, ci_setup,
     linting_setup, type_checking_strict, madurez_tests.
   Menos de 350 palabras."
```

Los 3 reportes se consolidan en `PROYECTO_PERFIL` en paso 0.5. Los pasos 0.2, 0.3
y 0.4 a continuación se vuelven **complementarios** (env vars, dev branch, docs/,
detección de archivos config en raíz que el team no leyó).

> **Por qué team también para proyectos planos**: análisis 3x más profundo y
> en paralelo, sin penalización de tiempo. Mejora la calidad de los archivos
> generados en Phase 2 (CLAUDE.md, develop-{tipo}.md, standards) porque parten
> de un perfil más rico.

---

## 0.2 — Complemento bash (datos que el team no cubre)

> El team analysis de 0.1c/0.1d ya cubrió stack, arquitectura, patrones y testing.
> Este bloque ejecuta sólo los comandos que el team **no hace** y que sí necesitamos
> para construir `PROYECTO_PERFIL`. Es deliberadamente liviano.

```bash
# Estructura raíz (visión general — útil para mostrar al usuario en el resumen)
ls -la

# Variables de entorno (keys, nunca valores)
cat .env.example 2>/dev/null || cat .env.local.example 2>/dev/null || cat .env.template 2>/dev/null

# /docs existente
test -d docs && echo "DOCS_DIR=EXISTS" || echo "DOCS_DIR=NOT_FOUND"
ls docs/ 2>/dev/null | head -20
ls docs/evidence/ 2>/dev/null | head -10
ls docs/api/ 2>/dev/null | head -10

# Rama de desarrollo (auto-detectada de remotas)
git branch -r --list 'origin/dev' 'origin/develop' 'origin/development' 2>/dev/null | sed 's|origin/||' | head -1 | xargs echo "DEV_BRANCH=" || echo "DEV_BRANCH=not_found"
```

## 0.3 — (deprecada — cubierta por team analysis)

> Antes este paso buscaba estructura de carpetas y patrones de archivos.
> Ahora lo hace **Agent 2 — Arquitectura & Patrones** (en proyectos planos)
> o el agent de cada subproyecto (en monorepos). Mantenemos la sección como
> placeholder histórico — no ejecutar comandos acá.

## 0.4 — (deprecada — cubierta por team analysis)

> Antes leía tsconfig, eslint, axiosInstance, auth store, hooks de ejemplo.
> Ahora lo hace **Agent 1 — Stack** y **Agent 2 — Arquitectura** en paralelo.
> Mantenemos la sección como placeholder histórico — no ejecutar comandos acá.

## 0.5 — Construir el perfil del proyecto

Con toda la información recopilada, construí internamente este perfil:

```
PROYECTO_PERFIL:
  nombre: [inferir del package.json "name" o nombre de carpeta raíz]
  tipo: [frontend | backend | fullstack | mobile | monorepo | monorepo-fullstack]
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
  tracker: [jira — detectado en 0.0c]
  cloud_id: [del paso 0.0c]
  workspace_name: [del paso 0.0c]
  project_key: [del paso 0.0c]
  jira_identity: [mcp_cloud — del paso 0.0d]
  jira_statuses: [mapping de statuses requeridos → nombres reales en Jira — del paso 0.0d]
  jira_statuses_missing: [lista de statuses faltantes — del paso 0.0d]
  # Notion-specific (if tracker=notion)
  notion_database_id: [del paso 0.0c — solo si tracker=notion]
  notion_database_name: [del paso 0.0c]
  notion_status_property: [del paso 0.0c]
  notion_unique_id_property: [del paso 0.0c]
  notion_statuses: [mapping de statuses requeridos → nombres reales en Notion — del paso 0.0d]
  notion_statuses_missing: [lista de statuses faltantes — del paso 0.0d]
  dev_branch: [dev | develop | development — auto-detectado de ramas remotas]
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

**Cuando terminés esta sub-fase**, continuá con `phase-0c-confirm.md`.
