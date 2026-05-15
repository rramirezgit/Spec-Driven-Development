# Changelog — Spec-Driven Development

Versionado de cambios funcionales del bootstrap, MCP server, hooks y templates.
Format: cada versión documenta el delta respecto de la anterior. La versión vigente
está al tope.

---

## V4.15 — `/menu` con una sola pregunta (auto-detección de contexto)

| Cambio | Impacto |
|--------|---------|
| **Pre-detección de contexto antes del menú** | Cuando `state=IDLE` y no hay `$ARGUMENTS`, ejecutar `git branch --show-current` + `gh pr view` en paralelo. Derivar `detectedTicket` (parseo regex `(feature\|hotfix\|bugfix)/([A-Z]+-[0-9]+)-.*` sobre la rama) y `detectedPR` (PR abierto del branch). Si `gh` falla o no hay remoto → degradación silenciosa, no se aborta. |
| **Etiquetas del menú con contexto** | Opciones 2 (Ticket) y 4 (Review PR) muestran el ID/PR detectado en la propia label, ej: `2. Ticket existente — detectado: AUTH-123`. Señaliza al usuario que esa selección NO va a re-preguntar. |
| **Opción 2 — sin segunda pregunta** | Resolución del ticket en cascada: `$ARGUMENTS` → `detectedTicket` → preguntar. Solo se pregunta si ninguno está disponible. Mensaje `🎯 Ticket detectado desde la rama: {ID}` cuando viene del branch. |
| **Opción 4 — sin segunda pregunta** | Cascada análoga: `$ARGUMENTS` → `detectedPR` → preguntar. Usa `gh pr view --json number,title,state` para detectar el PR del branch actual. |
| **Opción 5 — sin segunda pregunta** | Cascada: `$ARGUMENTS` → `activeTicket` del pipeline state → `detectedTicket` → preguntar. Aprovecha el ticket activo del ciclo en curso cuando existe. |
| **Opción 6 — sin segunda pregunta** | Default = buscar sprint activo automáticamente (Jira: `searchJiraIssuesUsingJql` con `sprint in openSprints()`; Notion: query por status). IDs explícitos solo vía `$ARGUMENTS` (`/menu sprint AUTH-1,AUTH-2`). |
| **Opción 1 — atajo con descripción** | `/menu feature "notificaciones push"` ejecuta directo sin preguntar. Sin `$ARGUMENTS` mantiene la pregunta única original. |
| **Atajos `$ARGUMENTS` ampliados** | Documentados todos los atajos parametrizables: `/menu <ID>`, `/menu pr <N>`, `/menu test <X>`, `/menu sprint <lista>`, `/menu feature <desc>`. |
| **Compat** | Opciones 3 (Explorar) y 7 (Release) no cambian. Si no hay contexto detectado y no hay `$ARGUMENTS`, el comportamiento es idéntico a V4.14 (se pregunta una vez). |

## V4.14 — Modo respeto de configuración preexistente (ADAM360-safe)

| Cambio | Impacto |
|--------|---------|
| **Phase 0b — detección defensiva** | Nuevo bloque `0.1bb` registra `claude_md_bytes`, `claude_settings_json_exists`, listas de agents/skills/commands en `.claude/`, `commitlint_detected`, `husky_prepush_detected`. Permite que SDD respete configs preexistentes en repos con `.claude/` ya poblado (ej. ADAM360 con 3 agents y 6 skills propios). |
| **Phase 0b — Nx + pnpm-workspace aware** | `0.1c` detecta `nx.json` y `pnpm-workspace.yaml`. Cuando aplica, los slugs candidatos para multi-target salen de `apps/*` y `services/*` con target deployable, en vez del walk genérico de directorios raíz. Packages workspace:* (libs internas) se ofrecen aparte y por default no entran al pipeline. |
| **Phase 0b — commit style por git log** | Nuevo bloque `0.2b` analiza últimos 20 commits con regex de Conventional Commits. Si ≥70% matchean, propone `commitStyle = conventional`. Funciona en repos sin `commitlint.config.*` (ADAM360 caso). |
| **Phase 0c — confirmación de preexistentes + commit style** | `1.0b` muestra apps/packages Nx detectados y pregunta cuáles entran al pipeline. `1.0c` reporta archivos `.claude/` preexistentes (informativo). `1.2` agrega pregunta `Estilo de commit` con default = inferido. Persiste a `project-profile.md` y `project-vars.sh` (`SDD_COMMIT_STYLE`, `SDD_EXISTING_CLAUDE_MD_BYTES`, `SDD_NX_DETECTED`). |
| **Phase 2 — modo preserve para CLAUDE.md** | Si `EXISTING_CLAUDE_MD_BYTES > 2048`, no sobreescribe. Genera `CLAUDE.sdd.md` aparte y agrega referencia idempotente `<!-- sdd-ref --> Pipeline SDD: ver [CLAUDE.sdd.md](./CLAUDE.sdd.md)` al final del original. Repos con CLAUDE.md curado no pierden el trabajo del equipo. |
| **`/commit` — adaptador Conventional Commits** | Nueva sección 4.0–4.2 lee `SDD_COMMIT_STYLE`. Modo `conventional`: subject `<type>(<scope>): <subject>` con type inferido del diff (feat/fix/chore/docs/refactor/test/perf/style/build/ci) y scope = slug multi-target o módulo afectado. Ticket ID baja al footer (`Refs: TICKET-ID`) para no romper commitlint. Modo `standard`: comportamiento histórico intacto. Bump `sdd-version: 1.0 → 1.1`. |
| **MCP — campo `commitStyle` en ProjectConfig** | `types.ts` agrega `commitStyle?: "standard" \| "conventional"`. `config.ts` parsea la clave `Commit Style` del profile (case-insensitive, default = `standard`). `parseProfile` ahora exportada para tests unitarios. |
| **Tests Vitest 34 → 41** | +7 tests en `tests/config.test.ts`: defaults a standard, parse explícito conventional/standard, case-insensitive, fallback a standard ante valor desconocido, trim de whitespace, backward-compat con multi-target + slugs. |
| **Backwards-compat estricta** | Proyectos pre-V4.14 sin `Commit Style` en el profile → `commitStyle = standard` (comportamiento histórico). Repos sin `.claude/` preexistente → flujo intacto. Repos sin `nx.json` → walk genérico. Detección por git log es opt-in: solo dispara la pregunta, nunca cambia el default sin confirmación. |

## V4.13 — Cleanup de basura generada + reducción de overlap

| Cambio | Impacto |
|--------|---------|
| Eliminados `meta-prompt.md` y `update-docs.md` de reusables | Decorativos sin uso real. `update-docs.md` tenía overlap 100% con `/generate-docs`. Proyectos pre-V4.13 con esos archivos no se rompen — siguen existiendo localmente, solo no se actualizan. |
| `/evidence` deja de generar `docs/api/` y `docs/components/` | Antes había race "last-write-wins" entre `/evidence` y `/generate-docs` que escribían los mismos paths. Ahora `/generate-docs` es la fuente única de docs cross-team; `/evidence` se limita a `docs/evidence/{TICKET_ID}.md`. |
| `/evidence` v3.0: 1 agent en vez de 2 | Antes lanzaba team de 2 (QA + Cross-team Doc). Como cross-team se movió a `/generate-docs`, queda solo el agent de QA evidence (más simple, menos tokens). |
| `.gitignore` raíz del repo SDD | Cubre `.bootstrap-staging.*/`, `.bootstrap-backup/`, `.bootstrap-meta.json`, `mcp-server/node_modules/`, `mcp-server/dist/`. Antes estos podían commitearse por accidente. |
| Trap de cleanup en `install-bootstrap.sh` antes de `mktemp` | Si Ctrl+C llega en los milisegundos entre crear staging y registrar trap, ya no quedaba directorio huérfano. Ahora trap registrado antes de crear el dir. Además, al inicio se limpian stagings huérfanos de runs previos. |
| Fail-safe en `bootstrap.md` modo upgrade | Si `.upgrade-pending` lleva >2 horas sin tocar, avisar al usuario que probablemente es huérfano. Documentado: NO borrar el archivo si el upgrade aborta — solo al completar. Garantiza idempotencia para retomar. |

## V4.12 — Teams en ejecución + UX multi-target + hardening cross-equipo

| Cambio | Impacto |
|--------|---------|
| Team de 2 agents en `/evidence` | QA Evidence + Cross-team Documentation en paralelo. Espacios de escritura disjuntos (docs/evidence vs docs/api+docs/components). ~40% menos tiempo. |
| Team de agents por fases en `/generate-docs` | Fase 1: Stack + Estructura paralelo. Fase 2: API + UI paralelo (solo los aplicables al stack). Fase 3: síntesis secuencial (arquitectura, ADRs, despliegue, flujos). Confirmación entre fases. |
| Auto-detección de target subproject | En multi-target, antes de preguntar el target, contar archivos modificados (`git diff main...HEAD`) por path de cada subproject. Sugerir el de mayor count como primera opción. Reduce fricción en multi-microservicio. |
| Fix MCP: `setTargetSubproject` requiere `activeTicket` | Antes permitía setear target sin ticket activo, llevando a errores confusos en advance. Ahora bloquea early con mensaje claro. |
| Hardening hook anti-refspec | `git push origin HEAD:main`, `+refs/heads/feature:refs/heads/main` y otras formas de refspec ahora bloqueadas (antes solo bloqueaba la forma directa). 10/10 casos test correctos. |
| Validación post-loop multi-target en Phase 2 | Después de generar `plan-{slug}-ticket.md` por cada slug, contar archivos generados vs esperados. Fallar early si incompleto. |
| `.phase-state.json` para handoff Phase 0a→0b→0c | Schema explícito. Cada sub-fase valida que la previa completó (`completed: true`) antes de empezar. Borrado al terminar 0c. |
| Tests MCP: 26 → 34 | +3 schema contract (per-ticket fields, gate flags), +4 transitions edge (rejects unknown destination, skip states), +3 isSafeBranchName edge (newline/tab/null byte). |

## V4.11 — Push a dev permitido + confirmación obligatoria en /commit

| Cambio | Impacto |
|--------|---------|
| Guard hook relajado | `guard-dangerous-ops.sh` ya NO bloquea `git push` a `dev` ni a feature branches. Sigue bloqueando push a `main`/`master`, push --force/-f, reset --hard, clean -f, y merges destructivos. Regex endurecida para evitar falsos positivos en branches con "main" como substring (ej. `feature/main-rewrite` pasa). |
| Confirmación obligatoria en /commit | Antes de cada `git push` (paso 5 push del feature branch, paso 6.2 push del merge a dev), `/commit` usa `AskUserQuestion` para pedir confirmación explícita al usuario. Opción "No pushear todavía" deja el commit/merge local intacto y HALT. |
| Filosofía | El bloqueo del hook era too aggressive (impedía push hasta a dev). La confirmación se mueve al lugar natural — el comando `/commit` — donde el usuario ve el resumen y decide. |

## V4.10 — Modo multi-target (microservicios / microfrontends)

| Cambio | Impacto |
|--------|---------|
| Modo multi-target opt-in | Phase 0c pregunta si N≥3 subproyectos o 2 del mismo tipo: ¿generar comandos por subproyecto o tratarlo como un único proyecto? |
| Schema extendido | `project-profile.md` agrega `Multi Target Mode` y `Subproject Slugs`. `project-vars.sh` genera variables iterables `SDD_SUB_{SLUG_UPPER}_PATH/FRAMEWORK/TYPE`. |
| Phase 2 con loop por subproyecto | Multi-target genera `develop-{slug}.md`, `plan-{slug}-ticket.md`, `{slug}-standards.mdc`, `{slug}-developer.md` — uno por servicio. Backwards-compat estricta con `monorepo-fullstack` 1+1 (sigue generando `frontend`/`backend`). |
| Menu y plan-ticket dinámicos | En multi-target, antes de planificar pregunta con `AskUserQuestion` qué subproyecto afecta el ticket y construye comandos con slug. Cada ticket = 1 servicio (regla acordada). |
| MCP `sdd_set_target_subproject` | Nuevo tool registra el subproyecto target en pipeline state. Gate de IMPLEMENTACION lo requiere si multi-target. Validación contra lista de slugs del profile. |
| CLAUDE.md con tabla de servicios | En multi-target, el CLAUDE.md generado abre con tabla `Servicio \| Path \| Tipo \| Framework \| Comando dev \| Standards` y delega detalles a cada `{slug}-standards.mdc`. |
| Tests Vitest extendidos | 26 tests (+3 schema contract: defaultPipelineData state inicial, targetSubproject null, gate flags). |

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
