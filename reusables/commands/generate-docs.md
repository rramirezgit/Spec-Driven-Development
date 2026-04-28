<!-- sdd-version: 2.0 -->
# Role
Technical documentation architect. Orquesta **teams de Explore agents en paralelo**
para generar documentación completa del proyecto. Itera por fases con confirmación
del usuario entre cada una.

# Arguments
`$ARGUMENTS`:
- Vacío → generar docs completos desde cero (iterativo)
- "update" → actualizar docs existentes basándose en cambios recientes
- Ruta de archivo → documentar solo ese archivo/módulo

# Process

## Modo: Generación completa (sin argumentos)

### Fase 1 — Análisis paralelo (team de 2 agents) + síntesis README/setup

> **CRÍTICO**: lanzar las 2 invocaciones de `Agent` en **un único mensaje** con
> múltiples tool uses (paralelo real).

#### Agent 1 — Stack & Setup (subagent_type: Explore)

```
"Analizá el stack y la configuración de setup del proyecto.

Tareas:
1. Lee package.json (o requirements.txt / go.mod / pom.xml / Cargo.toml).
   Lista deps directas y devDeps con versión exacta.
2. Lee .env.example, .env.template, .env.local.example si existen
   (KEYS solamente, nunca valores).
3. Detectá CI/CD: .github/workflows/, .gitlab-ci.yml, Jenkinsfile,
   bitbucket-pipelines.yml, circle.yml.
4. Detectá Docker: Dockerfile (todas las stages), docker-compose*.yml.
5. Detectá scripts del package.json relevantes para setup
   (dev, build, test, lint, db migrate, etc.).

Reportá un resumen estructurado:
- Framework + lenguaje + package manager
- Deps clave (UI, ORM, HTTP, testing, validation)
- Env vars requeridas + opcionales
- Setup steps (en orden)
- CI/CD detectado
- Docker/containerización presente

Menos de 400 palabras."
```

#### Agent 2 — Estructura & Convenciones (subagent_type: Explore)

```
"Mapeá la estructura del proyecto y sus convenciones.

Tareas:
1. Estructura de directorios (3 niveles, ignorando node_modules/dist/build/.git/.next).
2. Identificá patrón de organización: feature-based, layer-based, DDD, hexagonal, MVC.
3. Detectá naming conventions (kebab-case/camelCase, prefijos use-/get-, sufijos
   .service./.hook./.store.).
4. Localizá: README existente del proyecto, AGENTS.md, CLAUDE.md (no leer
   contenido — solo confirmar existencia).
5. Detectá tests: ubicación (junto a source vs carpetas separadas), framework.

Reportá:
- Tree resumido (5-10 directorios principales con propósito)
- Patrón de organización detectado
- Naming conventions
- Convenciones de testing
- Archivos meta presentes (README.md, AGENTS.md, etc.)

Menos de 400 palabras."
```

Cuando los 2 reporten, **el orquestador (no sub-agents)** sintetiza y crea:
- `docs/README.md` — índice completo, tree del proyecto, convenciones, changelog
- `docs/setup.md` — requisitos, instalación, troubleshooting

> **Cross-reference**: `docs/setup.md` referencia env vars a `ai-specs/specs/{tipo}-standards.mdc §12`
> en vez de copiarlas. Solo agrega notas adicionales de troubleshooting.

**Confirmar con el usuario antes de continuar a Fase 2.**

### Fase 2 — Endpoints + Components paralelo (team de 2 agents)

> **CRÍTICO**: paralelo real, mismo mensaje, múltiples Agent tool uses.
> Espacios de escritura disjuntos: Agent API → `docs/api/`, Agent UI → `docs/components/`.

#### Agent API (subagent_type: Explore) — solo si hay backend

```
"Documentá los endpoints HTTP del proyecto.

Tareas:
1. Buscá routes/controllers: *.route.*, *.controller.*, *.router.*, Next.js api/.
2. Buscá modelos/schemas/DTOs: *.model.*, *.schema.*, *.entity.*, *.dto.*.
3. Por cada módulo lógico (auth, users, payments, etc.):
   - Crear docs/api/{modulo}.md usando endpoint template de
     ai-specs/specs/documentation-standards.mdc.
   - Endpoints con method, ruta, auth, headers, params, body, response, errores.
   - Ejemplos request/response basados en DTOs/schemas REALES (no inventar).
   - Notas de implementación (reglas de negocio, limitaciones).
4. Crear docs/api/README.md con índice de módulos + auth + base URL + convenciones.

Espacio de escritura EXCLUSIVO: docs/api/. NO toques docs/components/.
Idioma: el del proyecto (AGENTS.md § Language o español).
NO inventar endpoints o comportamientos — '[POR COMPLETAR]' si falta info.

Reportá: lista de archivos creados + 1 línea por cada uno."
```

#### Agent UI (subagent_type: Explore) — solo si hay frontend

```
"Documentá los componentes UI del proyecto.

Tareas:
1. Buscá components: components/, app/ (Next.js App Router), pages/.
2. Identificá los más relevantes (formularios, layouts, vistas principales,
   componentes reutilizables).
3. Por cada componente o grupo:
   - Crear docs/components/{nombre}.md usando component template de
     documentation-standards.mdc.
   - Ubicación, descripción, props (TypeScript types reales).
   - Datos que consume (endpoint, hook, campos usados).
   - Estados (loading, empty, error, success).
   - Datos que necesita del backend.
4. Crear docs/components/README.md con índice de componentes.

Espacio de escritura EXCLUSIVO: docs/components/. NO toques docs/api/.
Idioma: el del proyecto.
NO inventar props o comportamientos.

Reportá: lista de archivos creados + 1 línea por cada uno."
```

Si el proyecto es **solo backend** → no lanzar Agent UI. Si es **solo frontend** → no lanzar Agent API. Si es fullstack → ambos en paralelo.

**Confirmar antes de Fase 3.**

### Fase 3 — Arquitectura + decisiones + despliegue + flujos (secuencial)

Esta fase requiere **síntesis** de las anteriores. NO se paraleliza — el orquestador lee
los outputs de Fase 1 y 2 (ya en disco) y produce documentos de alto nivel.

Generar:
- `docs/arquitectura.md` — Stack (referencia a CLAUDE.md para detalle), servicios, ambientes, dependencias externas. Enfoque en diagramas y visión de alto nivel, NO duplicar lo que ya está en `ai-specs/specs/`.
- `docs/decisiones.md` — ADRs inferidos: base de datos, framework, auth, deploy. Formato: Fecha, Estado, Contexto, Decisión, Consecuencias.
- `docs/despliegue.md` — CI/CD detectado, flujo de deploy, variables por ambiente, rollback.
- `docs/flujos.md` — flujos principales del sistema (auth, CRUD principal, etc.). Para cada flujo: descripción, pasos, casos edge. Placeholders para diagramas: `![Flujo X](./assets/flujo-x.svg)`. En comentarios HTML: prompt exacto para generar cada diagrama con Excalidraw MCP.

> **Cross-reference**: `docs/arquitectura.md` dice "Stack detallado en CLAUDE.md" y se enfoca
> en diagramas y decisiones arquitecturales, no en listar dependencias.

**Confirmar. Docs completos.**

## Modo: Actualización ("update")

1. `git diff HEAD~5` o cambios recientes
2. Comparar contra /docs existente
3. Actualizar solo lo que cambió
4. Actualizar fecha en archivos modificados
5. Si hay cambio significativo de arquitectura: nuevo ADR
6. Listar diagramas que necesitan regenerarse

## Modo: Archivo específico (ruta)

1. Leer el archivo
2. Determinar a qué doc pertenece (api, components, etc.)
3. Actualizar solo esa sección

# Rules
- TODO en {idioma_tecnico}
- Markdown limpio, sin HTML innecesario (excepto prompts de Excalidraw)
- NO inventar nada que no esté en el código
- `[POR COMPLETAR]` para lo que no se pueda inferir
- Ejemplos reales basados en schemas/tipos del código
- Cada archivo tiene "Última actualización: {FECHA}" arriba
- Usar templates de `documentation-standards.mdc` — no inline templates
- Cross-reference a ai-specs/ y CLAUDE.md cuando corresponda — no duplicar contenido
- Iterativo: confirmar con el usuario entre cada fase