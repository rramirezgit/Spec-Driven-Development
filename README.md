# AI Workflow Bootstrap V4.1

Sistema de flujos de trabajo asistidos por IA para Claude Code.

> ⚠️ **Repo privado** — No compartir el contenido de las fases.

## Setup rápido

En cada proyecto nuevo:

```bash
# Desde la raíz del proyecto
curl -sO https://raw.githubusercontent.com/TU-ORG/ai-bootstrap/main/install-bootstrap.sh
chmod +x install-bootstrap.sh
./install-bootstrap.sh
```

Luego en Claude Code:

```
/bootstrap
```

El sistema ejecuta 4 fases automáticamente (una por invocación de `/bootstrap`).

## Prerequisitos

- **Claude Code** instalado
- **openspec-cli** ≥ 0.5.0: `npm install -g openspec-cli`
- **gh CLI** autenticado: `brew install gh && gh auth login`
- Acceso de lectura a este repo

## Fases

| Fase | Duración | Qué hace |
|------|----------|----------|
| 0-2 | ~3 min | Detecta stack, pregunta lo mínimo, confirma |
| 3-4 | ~5 min | Crea 10 OPSX commands + 9 AI commands + 1 agente |
| 5 | ~5 min | Genera archivos adaptados al proyecto (CLAUDE.md, specs, etc.) |
| 5b-7 | ~3 min | Docs base, OpenSpec init, verificación final |

## Estructura del repo

```
ai-bootstrap/
├── phases/
│   ├── phase-0-detect.md        # Detección + preguntas + confirmación
│   ├── phase-1-reusables.md     # Dirs + archivos reusables
│   ├── phase-2-adapted.md       # Archivos adaptados al proyecto
│   └── phase-3-finalize.md      # Docs base + OpenSpec + verificación
├── bootstrap.md                 # Comando orquestador (se copia a .claude/commands/)
├── install-bootstrap.sh         # Script de instalación
└── README.md
```

## Qué se instala en el proyecto

```
proyecto/
├── .ai-internal/           ← gitignored, archivos de bootstrap
│   ├── phases/             ← las 4 fases (no se comparten)
│   └── project-profile.md  ← perfil generado (estado entre fases)
├── .claude/commands/
│   └── bootstrap.md        ← el comando /bootstrap
└── ... (lo que genera el bootstrap)
```

## Actualizar versión

1. Editar los archivos de fase en este repo
2. Push a main
3. En cada proyecto: `./install-bootstrap.sh` de nuevo (sobreescribe)

## Troubleshooting

**"PHASES_NOT_INSTALLED"** → Correr `./install-bootstrap.sh` primero

**Fase X falló a mitad** → Correr `/bootstrap` de nuevo, detecta automáticamente dónde quedó

**Quiero empezar de cero** → `/bootstrap` → elegir "Empezar de cero"
