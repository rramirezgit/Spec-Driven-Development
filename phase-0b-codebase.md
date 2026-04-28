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
- Para cada subproyecto, usar **Agent tool** (subagent_type=Explore) en paralelo para analizar cada subdirectorio:

  ```
  Agent 1 (frontend): "Analizá el subdirectorio {path_front}/:
    - Lee {path_front}/package.json completo
    - Detectá: framework, versión, UI library, state management, HTTP client, testing, form lib, validation lib
    - Explorá la estructura de carpetas (src/, app/, components/, etc.)
    - Leé archivos clave: tsconfig.json, theme config, auth store, un ejemplo de hook/component
    - Retorná un resumen estructurado con todos los datos detectados"

  Agent 2 (backend): "Analizá el subdirectorio {path_back}/:
    - Lee {path_back}/package.json (o equivalente) completo
    - Detectá: framework, versión, ORM, database, auth method, testing, validation lib
    - Explorá la estructura de carpetas (src/, controllers/, services/, etc.)
    - Leé archivos clave: main/app entry, un controller/service ejemplo, config de DB
    - Retorná un resumen estructurado con todos los datos detectados"
  ```

- Los resultados de ambos agents se usan para construir el perfil extendido (paso 0.5)
- **IMPORTANTE**: Los pasos 0.2, 0.3 y 0.4 se ejecutan igualmente para la raíz, pero los datos de cada subdirectorio vienen de los agents

**Si `es_monorepo == false`**: continuar con el flujo normal (paso 0.2).

---

## 0.2 — Exploración automática del codebase

Ejecutá estos comandos en secuencia y procesá la salida:

```bash
# Estructura raíz
ls -la

# Package.json (fuente principal de verdad para el stack)
# En monorepo: puede haber un package.json raíz con workspaces, o no haber ninguno
cat package.json 2>/dev/null || cat build.gradle 2>/dev/null || cat pom.xml 2>/dev/null || cat Cargo.toml 2>/dev/null || cat requirements.txt 2>/dev/null || cat go.mod 2>/dev/null

# Estructura src (en monorepo, esto estará en los subdirectorios — los agents ya lo analizaron)
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

# Detectar rama de desarrollo
git branch -r --list 'origin/dev' 'origin/develop' 'origin/development' 2>/dev/null | sed 's|origin/||' | head -1 | xargs echo "DEV_BRANCH=" || echo "DEV_BRANCH=not_found"

# Detectar tipo de proyecto (en monorepo, estos checks son para la raíz — pueden no matchear)
test -f next.config.js -o -f next.config.ts && echo "NEXTJS"
test -f vite.config.ts -o -f vite.config.js && echo "VITE"
test -f expo.json -o -f app.json && echo "EXPO"
test -f nest-cli.json && echo "NESTJS"
test -f manage.py && echo "DJANGO"
test -f artisan && echo "LARAVEL"
test -f go.mod && echo "GOLANG"
test -f Cargo.toml && echo "RUST"
```

## 0.3 — Explorar estructura de carpetas relevantes

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

## 0.4 — Leer archivos clave del proyecto

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
