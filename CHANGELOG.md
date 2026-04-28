# Changelog — Spec-Driven Development

Versionado de cambios funcionales del bootstrap, MCP server, hooks y templates.
Format: cada versión documenta el delta respecto de la anterior. La versión vigente
está al tope.

---

## V4.9 — Evidencia simplificada, sin Figma/Screenshot obligatorios

| Cambio | Impacto |
|--------|---------|
| Team analysis siempre activo en Phase 0b | 3 agents Explore en paralelo (stack / arquitectura / calidad) para proyectos planos. N agents (uno por subproyecto) para monorepos — escala automáticamente a microservicios. Reemplaza el bash secuencial. |
| Plantilla estándar de evidencia | Comentario al ticket es una plantilla fija con dos secciones ("Qué se hizo" y "Cómo probarlo"), ambas en lenguaje no técnico. Misma plantilla para todos los tipos de proyecto (backend, frontend, fullstack, mobile, infra). |
| Figma ya no es gate obligatorio | Eliminados `sdd_register_figma_link`, gate de IMPLEMENTACION y campo `figmaLink` del state. Figma sigue detectándose como MCP opcional en Phase 0. |
| Screenshot ya no es gate obligatorio | Eliminados `sdd_register_screenshot`, gate de EVIDENCIA→COMMIT y campo `screenshotCaptured` del state. `/evidence` ya no usa Chrome DevTools/Playwright. |
| Hardening del instalador | `install-bootstrap.sh` rechaza paths con traversal (`..`), valida HTTP status real para curl, detecta páginas HTML 404. |
| Hardening de hooks | `pre-compact-marker.sh` construye JSON con `jq -n` (safe contra special chars). `post-compact-reminder.sh` usa atomic `mv` (claim) para single-fire garantizado. Ambos validan `CLAUDE_PROJECT_DIR`. |
| Hardening del MCP server | `registerMerge` usa `execFileSync` (array form, sin shell) + valida nombres de rama con regex conservadora. |
| Validador de placeholders fix | `phase-2-adapted.md` busca el formato real `__SDD_*__` en vez de `{{...}}` (que nunca matcheaba). |

## V4.8 — Soporte Notion como tracker

| Cambio | Impacto |
|--------|---------|
| Soporte Notion como tracker | Notion puede usarse como alternativa a Jira para gestionar tickets. |
| Detección automática de tracker | Bootstrap detecta MCPs disponibles (Atlassian/Notion) y elige automáticamente. |
| MCP server: tracker abstraction | `tracker.ts` delega a `jira.ts` o `notion.ts` según config. |
| Tools renombrados | `sdd_transition_jira`/`sdd_comment_jira` → `sdd_transition_ticket`/`sdd_comment_ticket` (aliases backwards-compat). |
| Template Notion | `create-tickets-template-notion.md` para crear tickets en databases de Notion. |
| Sprint Gate Notion | Se desactiva automáticamente (Notion no tiene sprints nativos). |
| Guard hooks | Bloquea operaciones destructivas de Notion (`notion.*delete`). |

## V4.7 — Monorepo fullstack + fix transitions

| Cambio | Impacto |
|--------|---------|
| Soporte monorepo-fullstack | Detecta front+back en subdirectorios → genera archivos duales. |
| Fix hook Jira transitions | Las transiciones a QA ya no son bloqueadas por el guard hook. |

## V4.6 — Hooks anti-compactación + guard ops

| Cambio | Impacto |
|--------|---------|
| Hooks anti-compactación | `pre-compact-marker.sh` + `post-compact-reminder.sh` previenen acciones autónomas tras compactación. |
| Guard git/jira | `guard-dangerous-ops.sh` bloquea `git push --force`, merges a ramas protegidas, deletes en Jira/Notion. |

## V4.5 — Reusables modularizados

| Cambio | Impacto |
|--------|---------|
| Reusables como archivos individuales | OPSX commands, AI commands y agents se descargan uno por uno (antes embebidos en el bootstrap). |

## V4.4 — Flujo git completo + release-to-main

| Cambio | Impacto |
|--------|---------|
| Flujo git completo | Rama por ticket → merge directo a dev → QA en dev → PR dev→main via `/release-to-main`. |
| 5 columnas Jira | To Do → In Progress → QA Review → QA Approved/Failed → Done. |
| Verificación de columnas | Bootstrap detecta columnas del board y mapea automáticamente a los estados requeridos. |
| `/release-to-main` (opción 7) | Lee tickets QA Approved via JQL, crea PR dev→main con evidencia por ticket. |
| Hotfix support | `hotfix/*` branches crean PR directo a main (bypasean dev). |
| Auto-detección dev branch | Bootstrap detecta la rama de desarrollo existente (dev, develop, staging). |
| MCP server: transiciones custom | Lee nombres de columnas del perfil del proyecto para matching dinámico. |

## V4.3 — Atlassian MCP + screenshots (deprecado en V4.9)

| Cambio | Impacto |
|--------|---------|
| Verificación MCP Atlassian | Paso 0.0d: confirma que el MCP está autenticado (ya no pide email/token manual). |
| Screenshot en `/evidence` | Paso 3b: Chrome DevTools o screenshot manual para cambios frontend. **(Eliminado en V4.9.)** |
| Screenshot inline en evidencia | QA ve el screenshot directo en GitHub. **(Eliminado en V4.9.)** |

## V4.2 — Sprint Gate + ciclo obligatorio

| Cambio | Impacto |
|--------|---------|
| MCP Atlassian obligatorio | Si no está configurado, el bootstrap bloquea. |
| Auto-detección cloudId + projectKey | Ya no pregunta manualmente, lo obtiene del MCP. |
| Eliminada opción "Implementar directo" | Transición IDLE→PLAN removida del state machine. |
| Sprint Gate | Tickets deben estar en sprint activo para trabajar. |
| Un ticket a la vez | Ciclo completo obligatorio: implementar → evidencia → commit → merge → transición. |
| Rama por ticket | `feature/{ID}-{slug}` obligatoria, nunca en main. |

---

## Convenciones

- **Versión actual** está hardcodeada en `install-bootstrap.sh` y se compara con `.bootstrap-meta.json` para detectar upgrades.
- **Phase 0** lee de este archivo (`CHANGELOG.md`) cuando necesita mostrar qué cambió en una versión.
- **Nuevas versiones**: añadir entrada al tope con formato `## VX.Y — Resumen breve` + tabla `Cambio | Impacto`.
