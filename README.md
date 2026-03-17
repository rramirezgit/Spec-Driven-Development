# Spec-Driven Development — Bootstrap V4.8

Sistema de flujos de trabajo asistidos por IA para Claude Code.
Incluye un MCP server que controla el pipeline de forma programatica (state machine en codigo, no en prompts).

> **Repo privado** — No compartir el contenido de las fases.

---

## Prerequisitos

| Herramienta | Instalacion | Para que |
|---|---|---|
| **Node.js + npm** | [nodejs.org](https://nodejs.org) | Compilar el MCP server |
| **Claude Code** | `npm i -g @anthropic-ai/claude-code` | IDE con IA |
| **openspec-cli** | `npm i -g openspec-cli` | Gestion de specs y changes |
| **gh CLI** | `brew install gh && gh auth login` | Descargar desde este repo privado |
| **MCP Atlassian** | Configurar en Claude Code (Settings → MCP Servers) | **Obligatorio si tracker=Jira** — auto-detecta cloudId y project key |
| **MCP Notion** | Configurar en Claude Code (Settings → MCP Servers) | **Obligatorio si tracker=Notion** — auto-detecta database y propiedades |

### Nota sobre trackers

El sistema soporta **Jira** y **Notion** como trackers de tickets. Durante el bootstrap se detecta automaticamente cual MCP esta disponible:
- Si solo hay Atlassian → tracker=jira (automatico)
- Si solo hay Notion → tracker=notion (automatico)
- Si ambos estan disponibles → se pregunta al usuario

La interaccion con el tracker (transiciones, comentarios) se delega al MCP correspondiente. No se necesitan variables de entorno adicionales.

#### Jira
Las transiciones y comentarios se delegan al MCP de Atlassian. El bootstrap verifica columnas del workflow automaticamente.

#### Notion
Los tickets son paginas en una database de Notion. La database debe tener:
- Una propiedad **Unique ID** (genera IDs auto-incrementales como PROJ-1, PROJ-2)
- Una propiedad **Status** (o Select) con valores equivalentes a: To Do, In Progress, QA Review, Done
- Sprint Gate se desactiva automaticamente (Notion no tiene sprints nativos)

---

## Flujo de desarrollo (V4.8)

```
Ticket (To Do) → Crear rama feature/{ID}-slug
                → Desarrollar en la rama
                → Generar evidencia (/evidence)
                → Commit + merge directo a dev
                → Transicionar ticket a QA Review (con comentario completo)
                → QA prueba en ambiente dev
                    → QA Approved: ticket listo para release
                    → QA Failed: dev fixea en la rama, re-merge a dev
                → /release-to-main: lee tickets aprobados, crea PR dev → main
                → Merge PR → tickets a Done
```

### Statuses del tracker

#### Jira — Columnas requeridas (5)

| Columna | Aliases aceptados | Proposito |
|---------|-------------------|-----------|
| **To Do** | Backlog, Open, Abierto, Por Hacer | Estado inicial |
| **In Progress** | En Progreso, En Desarrollo | Developer trabajando |
| **QA Review** | QA, En QA, Code Review, En Revision | `/commit` transiciona aqui |
| **QA Approved / QA Failed** | QA Aprobado, Approved, Rechazado | QA aprueba o rechaza |
| **Done** | Hecho, Closed, Cerrado, Completado | Post-merge a main |

El bootstrap verifica automaticamente que el board tenga estas columnas (paso 0.0d).

#### Notion — Statuses requeridos (4)

| Status | Aliases aceptados | Proposito |
|--------|-------------------|-----------|
| **To Do** | Not started, Backlog, Por Hacer | Estado inicial |
| **In Progress** | En Progreso, Doing | Developer trabajando |
| **QA Review** | In review, En QA, Review | `/commit` transiciona aqui |
| **Done** | Complete, Hecho, Cerrado | Post-merge a main |

Sprint Gate no aplica para Notion (se bypasea automaticamente).

### Ramas

| Patron | Destino | Mecanismo |
|--------|---------|-----------|
| `feature/{ID}-slug` | dev | Merge directo (sin PR) |
| `hotfix/{ID}-slug` | main | PR directo a main |

---

## Instalacion desde cero

Para proyectos que **nunca tuvieron bootstrap**:

```bash
# 1. Ir a la raiz del proyecto
cd tu-proyecto

# 2. Descargar el installer
gh api repos/rramirezgit/Spec-Driven-Development/contents/install-bootstrap.sh \
  -H "Accept: application/vnd.github.raw+json" > install-bootstrap.sh

# 3. Ejecutar (descarga fases + MCP server + compila)
chmod +x install-bootstrap.sh
bash install-bootstrap.sh

# 4. Abrir Claude Code y ejecutar bootstrap (4 veces, una por fase)
/bootstrap
```

El installer descarga todo, compila el MCP server, y `/bootstrap` genera el `.mcp.json` en la fase final.

---

## Actualizar proyecto existente (cualquier version → V4.8)

Para proyectos que **ya hicieron bootstrap con cualquier version anterior** (incluyendo versiones pre-MCP que usaban `pipeline-tracker.md`):

```bash
# 1. Ir a la raiz del proyecto
cd tu-proyecto

# 2. Ejecutar el installer (sobreescribe fases + recompila MCP server)
bash install-bootstrap.sh
# Si no tenes el script: descargalo de nuevo con gh api (ver seccion "Instalacion desde cero")

# 3. Abrir Claude Code y re-ejecutar bootstrap
/bootstrap
```

El bootstrap detecta automaticamente el upgrade y entra en **Modo Upgrade**:
- **Archivos reusables** (opsx commands, AI commands): se sobreescriben siempre
- **Archivos adaptados** (menu.md, develop-{tipo}.md, etc.): se regeneran con el profile existente
- **MCP server**: se compila si no existia, se recompila si ya existia
- **project-profile.md**: se preserva — no se pierde nada
- **Gaps de infraestructura**: detecta y crea lo que falta (`.mcp.json`, `docs/`, playbook, etc.)
- **Pipeline legacy**: si tenia `pipeline-tracker.md`, lo migra a `pipeline-state.json`
- **Archivos editados manualmente**: backup antes de sobreescribir

> **Nota**: `migrate-to-mcp.sh` esta **deprecado** — el upgrade automatico de `/bootstrap` ahora cubre todo lo que hacia ese script (y mas). Usa `install-bootstrap.sh` + `/bootstrap` en su lugar.

### Que cambia en V4.8

| Cambio | Impacto |
|--------|---------|
| Soporte Notion como tracker | Notion puede usarse como alternativa a Jira para gestionar tickets |
| Deteccion automatica de tracker | Bootstrap detecta MCPs disponibles (Atlassian/Notion) y elige automaticamente |
| MCP server: tracker abstraction | `tracker.ts` delega a `jira.ts` o `notion.ts` segun config |
| Tools renombrados | `sdd_transition_jira`/`sdd_comment_jira` → `sdd_transition_ticket`/`sdd_comment_ticket` (aliases backwards-compat) |
| Template Notion | `create-tickets-template-notion.md` para crear tickets en databases de Notion |
| Sprint Gate Notion | Se desactiva automaticamente (Notion no tiene sprints nativos) |
| Guard hooks | Bloquea operaciones destructivas de Notion (`notion.*delete`) |

### Que cambia en V4.4

| Cambio | Impacto |
|--------|---------|
| Flujo git completo | Rama por ticket → merge directo a dev → QA en dev → PR dev→main via `/release-to-main` |
| 5 columnas Jira | To Do → In Progress → QA Review → QA Approved/Failed → Done |
| Verificacion de columnas | Bootstrap detecta columnas del board y mapea automaticamente a los estados requeridos |
| `/release-to-main` (opcion 7) | Lee tickets QA Approved via JQL, crea PR dev→main con evidencia por ticket |
| Hotfix support | `hotfix/*` branches crean PR directo a main (bypasean dev) |
| Comentario QA completo | Al transicionar a QA: resumen, archivos, plan de pruebas, screenshots, links de evidencia |
| Auto-deteccion dev branch | Bootstrap detecta la rama de desarrollo existente (dev, develop, staging) |
| MCP server: transiciones custom | Lee nombres de columnas del perfil del proyecto para matching dinamico |

### Que cambio en V4.3

| Cambio | Impacto |
|--------|---------|
| Verificacion MCP Atlassian | Paso 0.0d: confirma que el MCP esta autenticado (ya no pide email/token manual) |
| Screenshot en `/evidence` | Paso 3b: Chrome DevTools o screenshot manual para cambios frontend |
| Screenshot inline en evidencia | QA ve el screenshot directo en GitHub |

### Que cambio en V4.2

| Cambio | Impacto |
|--------|---------|
| MCP Atlassian obligatorio | Si no esta configurado, el bootstrap bloquea |
| Auto-deteccion cloudId + projectKey | Ya no pregunta manualmente, lo obtiene del MCP |
| Eliminada opcion "Implementar directo" | Transicion IDLE→PLAN removida del state machine |
| Sprint Gate | Tickets deben estar en sprint activo para trabajar |
| Un ticket a la vez | Ciclo completo obligatorio: implementar → evidencia → commit → merge → transicion |
| Rama por ticket | `feature/{ID}-{slug}` obligatoria, nunca en main |

### Archivos que se regeneran

Estos archivos se **sobreescriben** al re-ejecutar `/bootstrap`:

```
.claude/commands/menu.md              ← 7 opciones, Sprint Gate, release-to-main, ciclo obligatorio
ai-specs/.commands/develop-{tipo}.md  ← Step 0 crea rama, merge directo a dev
ai-specs/.commands/commit.md          ← merge a dev + comentario QA completo
ai-specs/.commands/release-to-main.md ← JQL QA Approved + PR dev→main
.claude/commands/create-*-tickets.md  ← asigna sprint + assignee
.ai-internal/mcp-server/              ← transiciones custom + merge a dev
.claude/commands/bootstrap.md         ← V4.4
.bootstrap-meta.json                  ← actualizado: version 4.4
```

---

## Menu de opciones (/menu)

| # | Opcion | Que hace |
|---|--------|---------|
| 1 | Crear artefactos | Genera specs, ADRs, diagramas |
| 2 | Crear tickets | Crea tickets en Jira desde artefactos |
| 3 | Planificar ticket | Selecciona ticket, genera plan tecnico |
| 4 | Implementar | Desarrolla segun el plan |
| 5 | Evidencia + commit | Genera evidencia, commit, merge a dev, transicion QA |
| 6 | Estado del pipeline | Muestra estado actual y siguiente accion |
| 7 | Release a main | Lee tickets QA Approved, crea PR dev→main |

---

## Como funciona el MCP server

```
Claude <-> MCP Server (stdio) <-> pipeline-state.json (local)
                               <-> Delegacion a MCP Atlassian (Jira)
```

El MCP server expone 7 herramientas que Claude llama como cualquier otro MCP tool:

| Tool | Que hace |
|------|----------|
| `sdd_check_config` | Valida project-profile, cloudId, tracker. Gate obligatorio. |
| `sdd_get_state` | Lee estado actual + que accion sigue + que comando ejecutar. |
| `sdd_advance` | Transiciona estado. Rechaza transiciones ilegales. Requiere activeTicket para PLAN/IMPLEMENTACION. |
| `sdd_register_tickets` | Registra tickets creados en el pipeline. Solo en ARTEFACTOS o TICKETS. |
| `sdd_set_active_ticket` | Marca ticket activo (valida que existe en la lista). Solo en TICKETS o PLAN. |
| `sdd_transition_ticket` | Genera instrucciones para transicionar ticket a QA Review via el tracker configurado (Jira o Notion). **Solo en COMMIT o COMPLETADO**. |
| `sdd_comment_ticket` | Genera instrucciones para comentar ticket con evidencia completa via el tracker configurado. **Solo en COMMIT o COMPLETADO**. |

### Transiciones validas (enforced en codigo)

```
IDLE -> ARTEFACTOS | TICKETS
ARTEFACTOS -> TICKETS | IDLE
TICKETS -> PLAN | IDLE
PLAN -> IMPLEMENTACION | IDLE
IMPLEMENTACION -> EVIDENCIA | IDLE
EVIDENCIA -> COMMIT | IDLE
COMMIT -> COMPLETADO | IDLE
COMPLETADO -> TICKETS | IDLE
```

Cualquier estado puede volver a IDLE (abandono controlado con confirmacion). Cualquier otra transicion es rechazada con error descriptivo.

### Que controla el MCP vs que controla Claude

| MCP Server (deterministic) | Claude (LLM) |
|---|---|
| Estado del pipeline | Ejecutar comandos .md |
| Validar transiciones | Interactuar con el usuario |
| Config gate | Crear artefactos (codigo, planes, evidencia) |
| Registro de tickets | Operaciones git (merge a dev, PR a main) |
| Persistencia JSON | Decidir que comando ejecutar (segun nextCommand) |
| Delegacion a MCP Atlassian | Ejecutar transiciones/comentarios Jira via MCP Atlassian |
| Matching de transiciones custom | HALT protocol y Skip Audit |

---

## Fases del bootstrap

| Fase | Que hace |
|------|----------|
| 0-2 | Detecta stack, verifica MCP Atlassian, valida columnas Jira, detecta dev branch, confirma perfil |
| 3-4 | Crea 10 OPSX commands + 10 AI commands + 1 agente |
| 5 | Genera archivos adaptados (CLAUDE.md, specs, menu.md con 7 opciones) |
| 6-7 | Docs base, OpenSpec init, MCP config, verificacion |

---

## Estructura del repo

```
Spec-Driven-Development/
├── phase-0-detect.md          # Deteccion + MCP verification + columnas Jira
├── phase-1-reusables.md       # Dirs + archivos reusables (commit, release-to-main)
├── phase-2-adapted.md         # Archivos adaptados (menu.md con 7 opciones)
├── phase-3-finalize.md        # Docs + OpenSpec + MCP config + verificacion
├── bootstrap.md               # Comando orquestador (/bootstrap)
├── install-bootstrap.sh       # Installer para proyectos nuevos
├── CLAUDE.md                  # Git Rules para este repo
└── mcp-server/                # MCP server del pipeline
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── types.ts           # Enums, interfaces, transiciones validas
        ├── config.ts          # Carga y validacion de project-profile + tracker statuses
        ├── pipeline.ts        # State machine (load, save, advance)
        ├── tracker.ts         # Abstraccion tracker — delega a jira.ts o notion.ts
        ├── jira.ts            # Delegacion a MCP Atlassian (transiciones custom)
        ├── notion.ts          # Delegacion a MCP Notion (status + comments)
        └── index.ts           # Server MCP con tools (+ aliases backwards-compat)
```

## Que se instala en el proyecto

```
proyecto/
├── .ai-internal/                  <- gitignored
│   ├── phases/                    <- las 4 fases de bootstrap
│   ├── project-profile.md         <- perfil detectado (incluye jira_statuses, dev_branch)
│   ├── pipeline-state.json        <- estado del pipeline (MCP)
│   └── mcp-server/                <- MCP server compilado
│       ├── src/
│       ├── dist/                  <- JS compilado
│       ├── package.json
│       └── node_modules/
├── .mcp.json                      <- config MCP para Claude Code
├── .claude/commands/
│   ├── bootstrap.md
│   └── menu.md                    <- orquestador con 7 opciones (usa MCP tools)
├── docs/evidence/                 <- evidencia por ticket ({TICKET_ID}.md + screenshots)
└── ... (lo que genera el bootstrap)
```

---

## Actualizar version

```bash
# 1. Editar archivos en este repo y pushear
# 2. En cada proyecto:
bash install-bootstrap.sh    # sobreescribe fases + recompila MCP server
# 3. Re-ejecutar bootstrap en Claude Code:
/bootstrap                   # detecta re-ejecucion, regenera archivos adaptados
```

Ver seccion "Actualizar proyecto existente" para detalles de que cambia en cada version.

---

## Troubleshooting

**"PHASES_NOT_INSTALLED"** — Ejecutar `install-bootstrap.sh`

**Fase X fallo a mitad** — Ejecutar `/bootstrap` de nuevo, detecta donde quedo

**MCP server no responde** — Verificar que esta compilado:
```bash
ls .ai-internal/mcp-server/dist/index.js
# Si no existe:
cd .ai-internal/mcp-server && npm install && npm run build
```

**sdd_check_config falla** — Verificar que existe `.ai-internal/project-profile.md` con cloudId y tracker

**sdd_transition_jira falla** — Verificar que el MCP de Atlassian esta configurado y autenticado en Claude Code

**Columnas Jira no detectadas** — Verificar que el board tenga las 5 columnas requeridas (To Do, In Progress, QA Review, QA Approved/QA Failed, Done)

**Merge a dev falla** — Verificar que la rama `dev` existe en el repo. El bootstrap la detecta automaticamente en paso 0.2

**Quiero empezar de cero** — `/bootstrap` y elegir "Empezar de cero"
