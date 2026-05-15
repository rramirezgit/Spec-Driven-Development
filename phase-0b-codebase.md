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

## 0.1bb — Detectar configuración existente de Claude Code y herramientas del repo (V4.14)

> **Por qué**: si el repo ya tiene `.claude/` con agents, skills, settings.json o un `CLAUDE.md` curado por el equipo, **no debemos sobreescribirlos**. SDD se instala respetando lo que ya existe (modo *preserve*) y agrega lo suyo al lado.

```bash
echo "=== EXISTING .claude/ DETECTION ==="
test -f .claude/settings.json && echo "CLAUDE_SETTINGS_JSON=EXISTS" || echo "CLAUDE_SETTINGS_JSON=NOT_FOUND"
if [ -d .claude/agents ]; then
  CLAUDE_AGENTS_LIST=$(find .claude/agents -maxdepth 1 -type f -name "*.md" 2>/dev/null | sed 's|^.claude/agents/||' | tr '\n' ',' | sed 's/,$//')
  echo "CLAUDE_AGENTS_LIST=$CLAUDE_AGENTS_LIST"
else
  echo "CLAUDE_AGENTS_LIST="
fi
if [ -d .claude/skills ]; then
  CLAUDE_SKILLS_LIST=$(find .claude/skills -maxdepth 2 -name "SKILL.md" 2>/dev/null | sed 's|^.claude/skills/||;s|/SKILL.md$||' | tr '\n' ',' | sed 's/,$//')
  echo "CLAUDE_SKILLS_LIST=$CLAUDE_SKILLS_LIST"
else
  echo "CLAUDE_SKILLS_LIST="
fi
if [ -d .claude/commands ]; then
  CLAUDE_COMMANDS_LIST=$(find .claude/commands -maxdepth 1 -type f -name "*.md" 2>/dev/null | sed 's|^.claude/commands/||' | tr '\n' ',' | sed 's/,$//')
  echo "CLAUDE_COMMANDS_LIST=$CLAUDE_COMMANDS_LIST"
else
  echo "CLAUDE_COMMANDS_LIST="
fi

if [ -f CLAUDE.md ]; then
  CLAUDE_MD_BYTES=$(wc -c < CLAUDE.md | tr -d ' ')
  echo "CLAUDE_MD_BYTES=$CLAUDE_MD_BYTES"
else
  echo "CLAUDE_MD_BYTES=0"
fi

# Señales secundarias (legacy — algunos repos todavía las tienen)
if ls commitlint.config.* >/dev/null 2>&1; then
  echo "COMMITLINT_DETECTED=true"
else
  echo "COMMITLINT_DETECTED=false"
fi
test -f .husky/pre-push && echo "HUSKY_PREPUSH_DETECTED=true" || echo "HUSKY_PREPUSH_DETECTED=false"
```

Construí internamente:

```
EXISTING_CONFIG:
  claude_settings_json_exists: [true | false]
  claude_agents_list: [lista o vacía]
  claude_skills_list: [lista o vacía]
  claude_commands_list: [lista o vacía]
  claude_md_bytes: [entero]
  commitlint_detected: [true | false]
  husky_prepush_detected: [true | false]
```

**Cuándo importa**:
- `claude_md_bytes > 2048` → Phase 2 entra en **modo preserve**: no sobreescribe `CLAUDE.md`, genera `CLAUDE.sdd.md` al lado y agrega una línea de referencia idempotente al final del original.
- `claude_settings_json_exists == true` → no escribir `.claude/settings.json` desde Phase 1/2 (SDD usa `settings.local.json`). Reportar al usuario en 0c.
- Listas no vacías de agents/skills/commands → reportar al usuario que se respetan; los archivos generados por SDD conviven con prefijo claro (no colisionan por ser nombres distintos).

---

## 0.1c — Detectar estructura monorepo (front + back en subdirectorios)

> **Por qué**: Si el proyecto tiene frontend y backend en carpetas separadas (ej: `app-front/` y `app-back/`),
> necesitamos analizar cada subdirectorio independientemente y generar agents/standards para ambos.

```bash
echo "=== MONOREPO DETECTION ==="

# Detectar Nx + pnpm-workspace (monorepo formal). Si existe, los subprojects salen
# de los paths declarados en pnpm-workspace.yaml (apps/*, packages/*, etc.) en vez
# del walk genérico de directorios raíz.
NX_DETECTED=false
PNPM_WORKSPACE_DETECTED=false
test -f nx.json && NX_DETECTED=true
test -f pnpm-workspace.yaml -o -f pnpm-workspace.yml && PNPM_WORKSPACE_DETECTED=true
echo "NX_DETECTED=$NX_DETECTED"
echo "PNPM_WORKSPACE_DETECTED=$PNPM_WORKSPACE_DETECTED"

# Si Nx + pnpm-workspace, expandir los globs (apps/*, packages/*) a subprojects reales.
# Solo se proponen como slugs los apps deployables (con target serve/start/dev en
# project.json). Los packages workspace:* (libs internas) se listan aparte y se
# preguntan en 0c — por default NO entran al pipeline.
NX_APPS=""
NX_PACKAGES=""
if [ "$NX_DETECTED" = "true" ] || [ "$PNPM_WORKSPACE_DETECTED" = "true" ]; then
  for d in apps/*/ packages/*/ libs/*/ services/*/; do
    [ -d "$d" ] || continue
    sub="${d%/}"
    name="${sub##*/}"
    parent="${sub%%/*}"
    # Considerar deployable solo si tiene project.json con target serve/start/dev
    is_deployable=false
    if [ -f "$sub/project.json" ]; then
      if grep -qE '"(serve|start|dev)"[[:space:]]*:' "$sub/project.json" 2>/dev/null; then
        is_deployable=true
      fi
    elif [ -f "$sub/package.json" ]; then
      if grep -qE '"(dev|start|serve)"[[:space:]]*:' "$sub/package.json" 2>/dev/null; then
        is_deployable=true
      fi
    fi
    if [ "$parent" = "apps" ] || [ "$parent" = "services" ] || [ "$is_deployable" = "true" ]; then
      NX_APPS="$NX_APPS $sub|$name"
    else
      NX_PACKAGES="$NX_PACKAGES $sub|$name"
    fi
  done
  echo "NX_APPS=$NX_APPS"
  echo "NX_PACKAGES=$NX_PACKAGES"
fi

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

# Si Nx detectado, sobreescribir SUBPROJECTS con los apps deployables.
# Los packages internos NO entran como SUBPROJECTS por default — Phase 0c puede
# preguntar al usuario si quiere subir alguno al pipeline.
if [ -n "$NX_APPS" ]; then
  SUBPROJECTS=""
  for entry in $NX_APPS; do
    sub="${entry%%|*}"
    name="${entry##*|}"
    SUBTYPE="unknown"
    if [ -f "$sub/next.config.js" ] || [ -f "$sub/next.config.ts" ] || [ -f "$sub/next.config.mjs" ]; then
      SUBTYPE="frontend:nextjs"
    elif [ -f "$sub/vite.config.ts" ] || [ -f "$sub/vite.config.js" ]; then
      SUBTYPE="frontend:vite"
    elif [ -f "$sub/nest-cli.json" ]; then
      SUBTYPE="backend:nestjs"
    elif [ -f "$sub/package.json" ]; then
      if grep -q '"@storybook/' "$sub/package.json" 2>/dev/null; then
        SUBTYPE="tooling:storybook"
      elif grep -q '"react"\|"vue"\|"@angular/core"\|"next"\|"nuxt"\|"svelte"' "$sub/package.json" 2>/dev/null; then
        SUBTYPE="frontend:react"
      elif grep -q '"express"\|"fastify"\|"koa"\|"@nestjs/core"\|"hapi"' "$sub/package.json" 2>/dev/null; then
        SUBTYPE="backend:node"
      fi
    fi
    echo "SUBPROJECT=$sub|$SUBTYPE"
    SUBPROJECTS="$SUBPROJECTS $sub"
  done
fi

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

## 0.2b — Inferir estilo de commit desde git log (V4.14)

> **Por qué**: ya no podemos asumir que la presencia de `commitlint.config.*` indica conventional commits — algunos repos los usan por convención humana sin tooling. La señal canónica es el historial.

```bash
echo "=== COMMIT STYLE INFERENCE ==="
COMMIT_TOTAL=$(git log --oneline -n 20 2>/dev/null | wc -l | tr -d ' ')
if [ "$COMMIT_TOTAL" -gt 0 ]; then
  COMMIT_CONVENTIONAL=$(git log --pretty=format:'%s' -n 20 2>/dev/null | grep -cE '^(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)(\([^)]+\))?(!)?: ')
  RATIO=$(awk "BEGIN { printf \"%.0f\", ($COMMIT_CONVENTIONAL / $COMMIT_TOTAL) * 100 }")
  echo "COMMIT_TOTAL=$COMMIT_TOTAL"
  echo "COMMIT_CONVENTIONAL=$COMMIT_CONVENTIONAL"
  echo "COMMIT_CONVENTIONAL_RATIO=$RATIO"
  if [ "$RATIO" -ge 70 ]; then
    echo "COMMIT_STYLE_INFERRED=conventional"
  else
    echo "COMMIT_STYLE_INFERRED=standard"
  fi
else
  echo "COMMIT_STYLE_INFERRED=standard"
fi
```

Construí internamente:

```
COMMIT_STYLE_DETECTION:
  inferred: [conventional | standard]
  ratio: [0..100]
  conventional_count: [entero]
  total_sampled: [entero]
```

Phase 0c **siempre confirma** este valor con el usuario antes de persistirlo (no se asume silenciosamente).

---

## 0.2c — Detectar Docusaurus (V4.16)

> **Por qué**: Si el proyecto ya tiene un site de Docusaurus, SDD debería actualizar
> esa documentación (no la flat de `docs/`) cuando un ticket toca contratos públicos,
> flujos o procesos. La detección habilita un gate adicional EVIDENCIA → COMMIT que
> obliga a registrar una decisión explícita de docs por ticket (no doc por defecto;
> doc solo cuando lo amerita).

```bash
echo "=== DOCUSAURUS DETECTION ==="
DOCUSAURUS_CONFIG=""
DOCUSAURUS_ROOT=""
DOCUSAURUS_DOCS_PATH=""
DOCUSAURUS_HAS_SIDEBAR=false

# 1) Buscar docusaurus.config.{js,ts,mjs,cjs} en ubicaciones canónicas.
#    Limitar profundidad a 3 para evitar walks costosos.
for cfg in $(find . -maxdepth 4 -type f \
    \( -name 'docusaurus.config.js' \
       -o -name 'docusaurus.config.ts' \
       -o -name 'docusaurus.config.mjs' \
       -o -name 'docusaurus.config.cjs' \) \
    -not -path '*/node_modules/*' \
    -not -path '*/.git/*' \
    -not -path '*/dist/*' \
    -not -path '*/build/*' 2>/dev/null); do
  DOCUSAURUS_CONFIG="$cfg"
  break
done

# 2) Fallback: grep en package.json por @docusaurus/core (cuando el config no está
#    en una ubicación estándar). Solo el primer match.
if [ -z "$DOCUSAURUS_CONFIG" ]; then
  PKG=$(grep -rlE '"@docusaurus/core"' --include=package.json \
        --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | head -1)
  if [ -n "$PKG" ]; then
    DOCUSAURUS_ROOT=$(dirname "$PKG")
    # Asumir docusaurus.config.* en el mismo dir
    for ext in js ts mjs cjs; do
      [ -f "$DOCUSAURUS_ROOT/docusaurus.config.$ext" ] && \
        DOCUSAURUS_CONFIG="$DOCUSAURUS_ROOT/docusaurus.config.$ext" && break
    done
  fi
fi

# 3) Si hay config, resolver root y docs path.
if [ -n "$DOCUSAURUS_CONFIG" ]; then
  DOCUSAURUS_ROOT=$(dirname "$DOCUSAURUS_CONFIG")
  # Leer el path de docs del config (default 'docs'). Buscar patrón path: 'X'.
  DOCUSAURUS_DOCS_PATH=$(grep -oE "path:[[:space:]]*['\"][^'\"]+['\"]" "$DOCUSAURUS_CONFIG" 2>/dev/null \
                        | head -1 | sed -E "s/.*['\"]([^'\"]+)['\"].*/\1/")
  [ -z "$DOCUSAURUS_DOCS_PATH" ] && DOCUSAURUS_DOCS_PATH="docs"
  # ¿Existe sidebar config? (señal de docs curados por humanos — SDD no toca el sidebar)
  if [ -f "$DOCUSAURUS_ROOT/sidebars.js" ] || \
     [ -f "$DOCUSAURUS_ROOT/sidebars.ts" ] || \
     [ -f "$DOCUSAURUS_ROOT/sidebars.json" ]; then
    DOCUSAURUS_HAS_SIDEBAR=true
  fi
  echo "DOCUSAURUS_DETECTED=true"
  echo "DOCUSAURUS_CONFIG=$DOCUSAURUS_CONFIG"
  echo "DOCUSAURUS_ROOT=$DOCUSAURUS_ROOT"
  echo "DOCUSAURUS_DOCS_PATH=$DOCUSAURUS_DOCS_PATH"
  echo "DOCUSAURUS_FULL_PATH=$DOCUSAURUS_ROOT/$DOCUSAURUS_DOCS_PATH"
  echo "DOCUSAURUS_HAS_SIDEBAR=$DOCUSAURUS_HAS_SIDEBAR"
else
  echo "DOCUSAURUS_DETECTED=false"
fi
```

Construí internamente:

```
DOCUSAURUS_DETECTION:
  detected: [true | false]
  config_path: [path al docusaurus.config.* o vacío]
  root: [carpeta del config — ej. "apps/docs", "website", "."]
  docs_path: [carpeta de docs leída del config — default "docs"]
  full_path: [root + "/" + docs_path]
  has_sidebar_config: [true | false]  # si true, no tocar sidebars.* — solo agregar archivos
  in_monorepo: [true si root != "."]
```

**Cuándo importa**:
- Si `detected == true` → Phase 0c pregunta al usuario si quiere habilitar el gate
  de docs por ticket. Si confirma, se persiste `Docusaurus Enabled: true` +
  `Docusaurus Root` + `Docusaurus Docs Path` en `project-profile.md` y el MCP server
  activa el gate EVIDENCIA → COMMIT.
- Si `detected == false` → SDD se comporta exactamente como V4.15 (no hay gate de
  docs, `/update-docs` no se invoca).

> **Comportamiento conservador**: aunque Docusaurus se detecte y habilite, el
> clasificador del comando `/update-docs` está diseñado para skip por default.
> Solo se escriben docs cuando hay un trigger de alta confianza (ver
> `reusables/commands/update-docs.md` §Triggers). La intención es evitar ruido:
> mejor un falso negativo (el dev documenta a mano) que un falso positivo
> (entradas vacías o triviales en el site).

---

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
  existing_config: [del paso 0.1bb — claude_md_bytes, claude_settings_json_exists, listas de agents/skills/commands]
  nx_detected: [true | false — del paso 0.1c]
  pnpm_workspace_detected: [true | false — del paso 0.1c]
  nx_packages_offered: [lista de packages workspace:* propuestos al user en 0c — vacía si nx_detected==false]
  commit_style_inferred: [conventional | standard — del paso 0.2b]
  commit_style_ratio: [0..100]
  tiene_docs: [true | false]
  docs_estructura: [descripción si existe]
  docusaurus_detected: [true | false — del paso 0.2c]
  docusaurus_root: [path al root del site Docusaurus, si detected]
  docusaurus_docs_path: [path relativo de docs en el site Docusaurus, si detected]
  docusaurus_has_sidebar_config: [true | false]
```

---

**Cuando terminés esta sub-fase**, continuá con `phase-0c-confirm.md`.
