# Spec-Driven Development — Bootstrap V4.2

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
| **MCP Atlassian** | Configurar en Claude Code (Settings → MCP Servers) | **Obligatorio** — auto-detecta cloudId y project key |

### Nota sobre Jira

La interaccion con Jira (transiciones, comentarios) se delega al MCP de Atlassian que ya esta configurado y autenticado en Claude Code. No se necesitan variables de entorno adicionales (`JIRA_API_TOKEN`/`JIRA_EMAIL` ya no son necesarias).

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

## Actualizar proyecto existente (cualquier version → V4.2)

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

### Que cambia en V4.2

| Cambio | Impacto |
|--------|---------|
| MCP Atlassian obligatorio | Si no esta configurado, el bootstrap bloquea |
| Auto-deteccion cloudId + projectKey | Ya no pregunta manualmente, lo obtiene del MCP |
| Eliminada opcion "Implementar directo" | Transicion IDLE→PLAN removida del state machine |
| Exploracion profunda obligatoria | Antes de artefactos o enrich-ticket |
| Sprint Gate | Tickets deben estar en sprint activo para trabajar |
| Asignacion de tickets al crear | Assignee + sprint activo automatico |
| Un ticket a la vez | Ciclo completo obligatorio: implementar → evidencia → commit → PR → transicion |
| Rama por ticket | `feature/{ID}-{slug}` obligatoria, nunca en main |

### Archivos que se regeneran

Estos archivos se **sobreescriben** al re-ejecutar `/bootstrap`:

```
.claude/commands/menu.md              ← nuevo: 6 opciones, Sprint Gate, ciclo obligatorio
ai-specs/.commands/develop-{tipo}.md  ← nuevo: Step 0 crea rama
.claude/commands/create-*-tickets.md  ← nuevo: asigna sprint + assignee
.ai-internal/mcp-server/              ← nuevo: sin transicion IDLE→PLAN, projectKey
.claude/commands/bootstrap.md         ← nuevo: V4.2
.bootstrap-meta.json                  ← actualizado: version 4.2
```

---

## Como funciona el MCP server

```
Claude <-> MCP Server (stdio) <-> pipeline-state.json (local)
                               <-> Jira REST API (para QA transition)
```

El MCP server expone 6 herramientas que Claude llama como cualquier otro MCP tool:

| Tool | Que hace |
|------|----------|
| `sdd_check_config` | Valida project-profile, cloudId, tracker. Gate obligatorio. |
| `sdd_get_state` | Lee estado actual + que accion sigue + que comando ejecutar. |
| `sdd_advance` | Transiciona estado. Rechaza transiciones ilegales con error. |
| `sdd_register_tickets` | Registra tickets creados en el pipeline. |
| `sdd_set_active_ticket` | Marca ticket activo (valida que existe en la lista). |
| `sdd_transition_jira` | Genera instrucciones para transicionar ticket a QA Review via MCP Atlassian. |
| `sdd_comment_jira` | Genera instrucciones para agregar comentario a ticket via MCP Atlassian. |

### Transiciones validas (enforced en codigo)

```
IDLE -> ARTEFACTOS | TICKETS
ARTEFACTOS -> TICKETS
TICKETS -> PLAN
PLAN -> IMPLEMENTACION
IMPLEMENTACION -> EVIDENCIA
EVIDENCIA -> COMMIT
COMMIT -> COMPLETADO
COMPLETADO -> TICKETS | IDLE
```

Cualquier otra transicion es rechazada con error descriptivo.

> **Nota V4.2**: La transicion `IDLE -> PLAN` fue eliminada. Ya no se puede implementar directamente sin pasar por artefactos/tickets primero.

### Que controla el MCP vs que controla Claude

| MCP Server (deterministic) | Claude (LLM) |
|---|---|
| Estado del pipeline | Ejecutar comandos .md |
| Validar transiciones | Interactuar con el usuario |
| Config gate | Crear artefactos (codigo, planes, evidencia) |
| Registro de tickets | Operaciones git |
| Persistencia JSON | Decidir que comando ejecutar (segun nextCommand) |
| Delegacion a MCP Atlassian | Ejecutar transiciones/comentarios Jira via MCP Atlassian |
| — | HALT protocol y Skip Audit |

---

## Fases del bootstrap

| Fase | Que hace |
|------|----------|
| 0-2 | Detecta stack, pregunta lo minimo, confirma perfil |
| 3-4 | Crea 10 OPSX commands + 9 AI commands + 1 agente |
| 5 | Genera archivos adaptados (CLAUDE.md, specs, menu.md) |
| 6-7 | Docs base, OpenSpec init, MCP config, verificacion |

---

## Estructura del repo

```
Spec-Driven-Development/
├── phase-0-detect.md          # Deteccion + preguntas + confirmacion
├── phase-1-reusables.md       # Dirs + archivos reusables
├── phase-2-adapted.md         # Archivos adaptados (incluye menu.md template)
├── phase-3-finalize.md        # Docs + OpenSpec + MCP config + verificacion
├── bootstrap.md               # Comando orquestador (/bootstrap)
├── install-bootstrap.sh       # Installer para proyectos nuevos
├── migrate-to-mcp.sh          # DEPRECADO — usar install-bootstrap.sh + /bootstrap
└── mcp-server/                # MCP server del pipeline
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── types.ts           # Enums, interfaces, transiciones validas
        ├── config.ts          # Carga y validacion de project-profile
        ├── pipeline.ts        # State machine (load, save, advance)
        ├── jira.ts            # Jira REST API (transition, comment)
        └── index.ts           # Server MCP con 6 tools
```

## Que se instala en el proyecto

```
proyecto/
├── .ai-internal/                  <- gitignored
│   ├── phases/                    <- las 4 fases de bootstrap
│   ├── project-profile.md         <- perfil detectado
│   ├── pipeline-state.json        <- estado del pipeline (MCP)
│   └── mcp-server/                <- MCP server compilado
│       ├── src/
│       ├── dist/                  <- JS compilado
│       ├── package.json
│       └── node_modules/
├── .mcp.json                      <- config MCP para Claude Code
├── .claude/commands/
│   ├── bootstrap.md
│   └── menu.md                    <- orquestador (usa MCP tools)
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

**Quiero empezar de cero** — `/bootstrap` y elegir "Empezar de cero"
