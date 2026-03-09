# Spec-Driven Development — Bootstrap V4.1

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

### Variables de entorno (para integracion Jira)

```bash
# Agregar a tu .zshrc o .bashrc
export JIRA_API_TOKEN=tu_api_token
export JIRA_EMAIL=tu_email@empresa.com
```

Sin estas variables el pipeline funciona, pero `sdd_transition_jira` no podra mover tickets a QA Review.

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

## Migracion (proyecto con bootstrap anterior)

Para proyectos que **ya hicieron bootstrap con la version prompt** (pipeline-tracker.md):

```bash
# 1. Ir a la raiz del proyecto
cd tu-proyecto

# 2. Descargar el script de migracion
gh api repos/rramirezgit/Spec-Driven-Development/contents/migrate-to-mcp.sh \
  -H "Accept: application/vnd.github.raw+json" > migrate-to-mcp.sh

# 3. Ejecutar
chmod +x migrate-to-mcp.sh
bash migrate-to-mcp.sh
```

El script hace 5 pasos:

1. Descarga el MCP server a `.ai-internal/mcp-server/`
2. Ejecuta `npm install && npm run build`
3. Genera `.mcp.json` con el server configurado
4. Migra `pipeline-tracker.md` a `pipeline-state.json` (con backup)
5. Detecta si `menu.md` es viejo y avisa que hay que regenerarlo

### Regenerar menu.md despues de migrar

El script va a decir que `menu.md` necesita actualizarse. Dos opciones:

**Opcion A** (recomendada): Abrir Claude Code y ejecutar `/bootstrap` — regenera todo.

**Opcion B** (rapida): Decirle a Claude:
> Lee `.ai-internal/phases/phase-2-adapted.md`, busca la seccion de `menu.md` y regenera `.claude/commands/menu.md` con el template nuevo.

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
| `sdd_transition_jira` | Mueve ticket a QA Review via Jira REST API. |

### Transiciones validas (enforced en codigo)

```
IDLE -> ARTEFACTOS | TICKETS | PLAN
ARTEFACTOS -> TICKETS
TICKETS -> PLAN
PLAN -> IMPLEMENTACION
IMPLEMENTACION -> EVIDENCIA
EVIDENCIA -> COMMIT
COMMIT -> COMPLETADO
COMPLETADO -> TICKETS | IDLE
```

Cualquier otra transicion es rechazada con error descriptivo.

### Que controla el MCP vs que controla Claude

| MCP Server (deterministic) | Claude (LLM) |
|---|---|
| Estado del pipeline | Ejecutar comandos .md |
| Validar transiciones | Interactuar con el usuario |
| Config gate | Crear artefactos (codigo, planes, evidencia) |
| Registro de tickets | Operaciones git |
| Persistencia JSON | Decidir que comando ejecutar (segun nextCommand) |
| Jira REST API | HALT protocol y Skip Audit |

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
├── migrate-to-mcp.sh          # Migracion para proyectos existentes
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
```

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

**sdd_transition_jira falla** — Verificar `JIRA_API_TOKEN` y `JIRA_EMAIL` en env vars

**Quiero empezar de cero** — `/bootstrap` y elegir "Empezar de cero"
