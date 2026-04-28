# Bootstrap Prompt — AI Workflow Setup (orquestador Phase 0)

> **Versión y changelog**: ver `CHANGELOG.md` en la raíz del proyecto para historial completo de versiones.
>
> **Prerequisitos**:
> - `npm install -g openspec-cli@^0.5.0` — debe estar instalado globalmente **antes** de correr este prompt (versión mínima 0.5.0)
> - `openspec --version` debe retornar una versión válida ≥ 0.5.0
> - MCPs instalados y autenticados: Atlassian o Notion (al menos uno), GitHub
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

Para mantener manejable el contenido y reducir riesgo de pérdida de contexto, **Phase 0 está dividida en 3 sub-archivos** que debés leer y ejecutar **en orden estricto**:

| Orden | Archivo | Responsabilidad |
|-------|---------|-----------------|
| 1️⃣ | `.ai-internal/phases/phase-0a-mcps-tracker.md` | openspec check, legacy cleanup, detección de MCPs, elección de tracker (Jira/Notion), config y verificación de workflow del tracker |
| 2️⃣ | `.ai-internal/phases/phase-0b-codebase.md` | CLAUDE.md previo, config previa (incremental), detección de monorepo, **análisis profundo con team de Explore agents en paralelo** (3 agents para proyectos planos: stack/arquitectura/calidad — N agents para monorepos: uno por subproyecto), construcción de `PROYECTO_PERFIL` |
| 3️⃣ | `.ai-internal/phases/phase-0c-confirm.md` | Fase 1 (preguntas pendientes), Fase 2 (resumen + confirmación), guardado de `project-profile.md` y `project-vars.sh` |

### Cómo orquestar

1. **Leé `phase-0a-mcps-tracker.md` por completo** y ejecutá todos sus pasos. **No saltes a Phase 0b hasta haber completado Phase 0a entero**.
2. Cuando Phase 0a termine (con tracker confirmado y workflow validado), **leé `phase-0b-codebase.md`** y ejecutá sus pasos.
3. Cuando Phase 0b termine (con `PROYECTO_PERFIL` construido en memoria), **leé `phase-0c-confirm.md`** y ejecutá sus pasos.
4. Al final de Phase 0c quedará escrito `.ai-internal/project-profile.md` y `.ai-internal/project-vars.sh`. Mostrar:

   ```
   ✅ Fase 0-2 completada. Perfil guardado.
      Siguiente: ejecutá /bootstrap para Fase 3-4 (archivos reusables)
   ```

### Reglas globales de Phase 0

- **No hagas preguntas hasta Phase 0c.** Phase 0a y 0b son inferencia automática + bloqueos por configuración faltante; sólo se rompe el silencio para `AskUserQuestion` cuando hay ambigüedad real (múltiples workspaces/databases/proyectos).
- **Si algún sub-archivo bloquea por configuración faltante** (MCP no configurado, columnas faltantes, openspec viejo) → DETENER toda la fase. No avanzar al siguiente sub-archivo.
- **Estado entre sub-archivos**: Phase 0a deja `TRACKER`, `MCPS_DISPONIBLES` y datos del tracker (cloudId, projectKey, etc.) en memoria conversacional. Phase 0b agrega `ESTADO_CONFIG` y `MONOREPO_DETECTION`. Phase 0c los consolida todos en `PROYECTO_PERFIL` y persiste a disco.
- **Idioma**: las preguntas al usuario van en español por default. El idioma de tickets se pregunta explícitamente en Phase 0c.

---

> **Para mantenedores**: este archivo es un orquestador delgado. La lógica operativa vive en los 3 sub-archivos `phase-0a/0b/0c`. Si tenés que modificar instrucciones de detección, edita el sub-archivo correspondiente. Si tenés que modificar el orden o agregar una nueva sub-fase, actualizá la tabla y las reglas globales acá.
