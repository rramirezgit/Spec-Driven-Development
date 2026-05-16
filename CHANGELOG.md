# Changelog — Spec-Driven Development

Versionado de cambios funcionales del bootstrap, MCP server, hooks y templates.
Format: cada versión documenta el delta respecto de la anterior. La versión vigente
está al tope.

---

## V4.21 — /goal (batch supervisado de tickets con safeguards)

| Cambio | Impacto |
|--------|---------|
| **Nuevo comando `/goal`** | Orquestador batch: toma una lista de tickets (sprint completo, lista explícita, o IDs sueltos) y ejecuta el cycle SDD completo por cada uno (DoR → branch → plan → develop → auto-verify → evidence → docs → commit local). Pausas explícitas en pre-flight fail y zonas de riesgo. Reporte final obligatorio con sección de seguridad. |
| **3 modes** | `supervised` (default): pre-flight + 1 confirmación humana per-ticket en sdd_confirm_implementation; sin push automático. `auto-merge-final`: igual a supervised pero al final ofrece dashboard de aprobación + merge batch a dev. `yolo`: sin confirmación per-ticket (requiere `--yolo --i-accept-the-risks` — dos flags), pero HIGH risk sigue bloqueando + safeguards non-negociables. |
| **MCP server — 3 tools nuevos (16-18)** | `sdd_register_goal({tickets, mode})` arranca sesión (solo IDLE/TICKETS, max 30 tickets, sanitización + dedup). `sdd_update_goal_progress({ticketId, status, reason?, autoVerify?})` reporta outcome per-ticket; cierre automático cuando todos terminan. `sdd_abort_goal({reason})` aborta con razón obligatoria (≥5 chars). |
| **GoalSession en PipelineData** | Persiste {tickets, mode, progress{}, startedAt, finishedAt, aborted, abortReason}. Por-ticket: status (pending\|in_progress\|completed\|paused\|failed\|skipped), reason, autoVerify outcome, timestamps. Cleared en IDLE; sobrevive cycle restarts COMPLETADO→TICKETS. |
| **Pre-flight checks por ticket** | DoR validation (si falla y mode≠yolo → pause + `/refine-ticket`); risk classification (HIGH + supervised → AskUserQuestion; HIGH + yolo → bloquea); paths sensibles explícitos (auth/payment/migration/secrets); test cases declarados ≥3. |
| **Safeguards non-negociables (aún en yolo)** | Nunca push automático a remoto. Nunca merge a main/master/production. Si 2 tickets seguidos fallan auto-verify → abort. Si tests del proyecto se rompen → abort. Paths bloqueados (.env, secrets/, migrations/) requieren DoR completa. Reporte de seguridad final SIEMPRE se genera. |
| **menu-template Opción 8** | Nueva opción "Goal" en el menú con sub-opciones (sprint, IDs explícitos, modo). Atajos `$ARGUMENTS` ampliados: `/menu goal`, `/menu goal sprint`, `/menu goal AUTH-1,AUTH-2`. |
| **Reporte final** | Dashboard con COMPLETED / PAUSED / FAILED + reporte de seguridad. Por cada completed: ticket + risk level + smoke status. Por cada paused: razón concreta. Auto-merge-final: pregunta merge con opciones "Todos / Uno por uno / Solo X / Ninguno". |
| **Bootstrap** | Bump V4.20 → V4.21. `install-bootstrap.sh` registra `reusables/commands/goal.md`. Manifest regenerado (49 archivos). |
| **Backwards-compat** | `goalSession=null` default. Sin batch activo, comportamiento idéntico a V4.20. La sesión bloquea inicio de otra hasta finishedAt o aborted (no anidamiento). |

## V4.20 — Auto-verify (smoke tests post-implementación, L1)

| Cambio | Impacto |
|--------|---------|
| **Nuevo comando `/auto-verify`** | Smoke tests HTTP automáticos para endpoints/rutas que cambiaron en el ticket. Reusa diff cache (V4.17) + clasificador de `/update-docs` (V4.16) para identificar T1/T2 (endpoint nuevo/modificado). Para cada uno: ping al dev server local, curl con payload mínimo del schema, valida status + shape de response. Reporta passed/failed/inconclusive/skipped. **L1 = solo smoke API**; L2 (Chrome DevTools UI) queda para V4.21. |
| **MCP server — `sdd_register_auto_verification`** | Tool con schema `{status, reason, cases[], blockers[]}`. Validaciones: razón obligatoria; `passed` requiere cero failed cases; `failed` requiere ≥1 failed case o blocker; max 50 cases por ticket; detail por case truncado a 200 chars. Solo válido en IMPLEMENTACION. Persiste en `data.autoVerifyResult`. |
| **MCP server — gate opcional IMPLEMENTACION → EVIDENCIA** | Si `autoVerify.enforced=true` y `autoVerifyResult.status="failed"` → bloquea con guía de blockers. `inconclusive` (dev server down) NO bloquea — degrade gracefully. Sin enforced, resultado es informativo. |
| **`AutoVerifyConfig` en ProjectConfig** | Nuevo campo opcional `{enabled, devPort, healthEndpoint, enforced}`. Parser case-insensitive con misma estrategia que otras V4.* configs. Ausente = inactive. |
| **Phase 0b — detección de capability** | Nuevo bloque `0.2d`: detecta script de dev en `package.json`, puerto del config del framework (Next/Vite/Nest) o `.env.example`, endpoint de health/ping si existe, Playwright/Cypress instalado, `.env.test` presente. Decisión `AUTO_VERIFY_CAPABLE = dev_script_found AND dev_port`. |
| **Phase 0c — pregunta de habilitación** | Solo si capability detected. AskUserQuestion con 3 opciones: informativo (default — corre pero no bloquea), enforced (bloquea EVIDENCIA si fails), deshabilitado. Persiste `Auto Verify Enabled/Enforced/Dev Port/Health Endpoint` en profile + exporta `SDD_AUTO_VERIFY_*` a vars. |
| **menu-template — paso /auto-verify antes del gate humano** | Sección IMPLEMENTACION ahora documenta: si `Auto Verify Enabled=true`, correr `/auto-verify` ANTES de `sdd_confirm_implementation`. El resultado se muestra al humano para que confirme con contexto. **Auto-verify NO reemplaza al gate humano** — lo enriquece. |
| **Protecciones del comando** | Nunca toca prod/staging (validación localhost-only obligatoria, abort si host ≠ localhost). Nunca arranca dev server (solo ping). Nunca usa credentials reales (lee `.env.test` solamente). Buffer corto en outputs (status code + 1ra línea body — no volcar bodies completos al chat). |
| **Bootstrap** | Bump V4.19 → V4.20. `install-bootstrap.sh` registra `reusables/commands/auto-verify.md`. Manifest regenerado (48 archivos). |
| **Backwards-compat** | Sin `Auto Verify Enabled: true` en el profile → command no se invoca, gate inactivo, comportamiento idéntico a V4.19. Habilitación es opt-in vía Phase 0c. |

## V4.19 — Gap analysis + risk classification dentro de menu Opción 1

| Cambio | Impacto |
|--------|---------|
| **Gap analysis durante feature definition (menu Opción 1)** | Después de exploración y antes de `/opsx:ff`, agent identifica ambigüedades del feature (scope, integraciones, modelo de datos, rollout, error handling) y pregunta al usuario en UNA tanda de ≤5 preguntas. Las respuestas se persisten en `data.changeDecisions[]` y son consumidas por `/create-tickets-*` para inlinearlas en cada Story. Esto evita el goteo de re-preguntas durante enrich/plan/implement. |
| **Risk classification automática** | Función pura `classifyRisk({paths, description})` retorna `{level: 'low'\|'medium'\|'high', reasons}`. Triggers HIGH: auth/oauth/session/jwt/payment/billing/migrations/secrets/crypto/cron/webhook/iam/rbac + keywords (breaking, rotation, delete all, drop table). Triggers MEDIUM: api/routes/controllers/components/hooks/services. Conservadora: prefiere over-classify. |
| **3 nuevos MCP tools (12-14)** | `sdd_classify_risk` (pura, no persiste), `sdd_register_risk` (persiste change o ticket level), `sdd_register_change_decisions` (persiste Q&A batch). Validaciones: max 25 decisiones por change, 500 chars por Q/A, ticket ID sanitizado, max 10 razones por classification. |
| **PipelineData extendido** | Nuevos campos: `changeDecisions[]` + `changeRisk` + `ticketRisks{}`. Se persisten across el change (NO se borran en cycle restart per-ticket); se limpian solo en IDLE. Permite acumular contexto a través de los tickets del mismo change. |
| **menu-template Opción 1 — 2 sub-pasos nuevos** | Pasos 3 (Gap Analysis) y 4 (Risk Classification) insertados entre síntesis de exploración y `/opsx:ff`. Documentados categóricamente: tipos de preguntas a hacer (scope, user behavior, integraciones, etc.). Si feature simple sin ambigüedades, agent puede registrar `[{question: "Sin ambigüedades", answer: "ok"}]` para log explícito. |
| **create-tickets-* — Step 3b nuevo** | Antes de redactar Stories: `sdd_get_state` para leer `changeDecisions` + `changeRisk`, `sdd_classify_risk` per-Story con sus paths, `sdd_register_risk(scope: 'ticket')`. Filtra decisiones por `affectsTickets` para incluir solo las relevantes en cada Story. Templates Jira + Notion sincronizados byte-por-byte. |
| **Template Story V4.19 — secciones nuevas** | Stories ahora terminan con: `## Decisiones del PO` (Q&A del gap analysis relevantes a este ticket) + `## Riesgo` (level + razones, con callout especial si HIGH). Si no hay decisiones aplicables, sección se omite. |
| **Nuevo comando `/refine-ticket`** | Comando interactivo y liviano (no toca codebase). Valida ticket contra DoR, identifica gaps, pregunta al usuario en una tanda (≤5), actualiza tracker, revalida. **Diferencia con `/enrich-ticket`**: enrich explora codebase y completa inferible; refine pregunta al humano lo que solo él sabe. Casos: tickets pre-V4.18, tickets creados fuera de SDD, gaps que el agent no puede inferir. |
| **Tests** | +25 tests en `risk.test.ts` cubren: HIGH triggers (auth, payment, migrations, secrets, cron, webhooks, breaking, drop table), MEDIUM (api, components, hooks), LOW default, mixing rules (high > medium > low), explicabilidad (reasons no vacío). Total: 96 tests pasando (71 V4.18 + 25 V4.19). |
| **Bootstrap** | Bump V4.18 → V4.19. `install-bootstrap.sh` registra `reusables/commands/refine-ticket.md`. Manifest regenerado (47 archivos). |
| **Backwards-compat** | `changeDecisions=[]` y `changeRisk=null` son defaults seguros. Proyectos pre-V4.19 que re-corran el menu Opción 1 obtienen el nuevo flujo automáticamente. Tickets creados fuera del flujo (sin gap analysis) siguen funcionando — el create-tickets avisa pero no bloquea. |

## V4.18 — Definition of Ready (schema obligatorio + gate de validación)

| Cambio | Impacto |
|--------|---------|
| **Template Story de 8 secciones obligatorias** | `create-tickets-template.md` y `create-tickets-template-notion.md` (sincronizados byte-por-byte) extienden el template con: `Objetivo`, `Contexto técnico`, `Criterios de aceptación` (formato Dado/Cuando/Entonces, ≥2), `Fuera de scope` (≥1 ítem, prohibido "nada"/"ninguno"), `Dependencias`, `Riesgos`, `Test cases declarados` (≥3: golden + 2 edge), `Definition of Done` (≥3 items). Sub-tasks tienen template más liviano — heredan del Story padre. |
| **MCP server — validador puro `validateTicketDor`** | Pure function en `pipeline.ts` que recibe el body markdown del ticket y retorna `{ok, errors[], warnings[], sections{}}`. Detecta cada sección con regex tolerante (H1-H4 o **bold**, español o inglés). Reglas por sección: AC mínimo 2 + scanner de lenguaje vago (correctamente, apropiadamente, intuitivo, user-friendly, works correctly, properly, intuitive, easy-to-use); OOS rechaza "nada/ninguno/N/A"; Test cases mínimo 3; DoD ≥3 advierte (warning, no error). |
| **MCP server — nuevo tool `sdd_validate_ticket_dor`** | Acepta `{ticketId, body, skip?, skipReason?}`. Persiste el resultado en `pipeline-state.json` como `data.dorValidation = {ticketId, status: "passed"\|"warned"\|"failed"\|"skipped", mode, errorCount, warningCount, timestamp, skipReason?}`. Body máximo 100 KB. Skip requiere razón ≥10 chars. |
| **MCP server — gate `sdd_advance(PLAN)` en modo strict** | En `dorEnforcement: "strict"`, la transición a PLAN rechaza si `dorValidation` no es `passed` o `skipped` para el ticket activo. En modo `warn` el validador igual corre pero NO bloquea. En `off` (default backward-compat) el gate está inactivo. |
| **`ProjectConfig.dorEnforcement`** | Nuevo campo opcional parseado de la key `DoR Enforcement` del profile (case-insensitive). Default = `off` si la key está ausente (proyectos pre-V4.18 no se rompen). Phase 0c default para bootstraps nuevos = `warn`. |
| **`enrich-ticket-template.md` reescrito** | Ahora corre `sdd_validate_ticket_dor` como primer paso, identifica gaps, enriquece **sin inventar** (TODO explícito si no hay datos del codebase), pre-confirma con el usuario antes de actualizar el tracker, revalida después. Manejo explícito de hotfix con bypass. Preserva el original como `[Original]`. |
| **Phase 0c — pregunta de DoR mode** | Nuevo paso `1.0d-pre` con AskUserQuestion: Warn (recomendado para empezar) / Strict / Off. Persiste `DoR Enforcement` en `project-profile.md` + exporta `SDD_DOR_ENFORCEMENT` a `project-vars.sh`. |
| **menu-template — DoR gate antes de PLAN** | Sección "TICKETS → seleccionar UN ticket" documenta el flujo: sprint gate → multi-target gate → DoR gate (V4.18) → `sdd_advance(PLAN)`. Si modo `strict` y ticket falla, ofrece `/enrich-ticket` antes de re-validar. |
| **Sub-tasks exentas** | El validador V4.18 NO aplica a sub-tasks. Solo Stories/Tasks/Features. Las sub-tasks heredan el contexto del padre. |
| **Tests** | +18 tests cubren: golden path, secciones ausentes, AC count + lenguaje vago, OOS empty/"nada", Test cases count, DoD warning, soporte español + inglés. Total: 71 tests pasando (53 previos + 18 nuevos). |
| **Backwards-compat estricta** | Proyectos pre-V4.18 sin `DoR Enforcement` en el profile → modo `off` → ningún gate adicional → comportamiento exacto de V4.17. Tickets antiguos sin las 8 secciones siguen siendo planificables si el modo es `off` o `warn`. Strict mode es opt-in explícito vía bootstrap. |

## V4.17 — Optimización de tokens (cache de diff, log trim, agents JSON)

| Cambio | Impacto |
|--------|---------|
| **Cache de diff por ciclo de ticket** | Nuevo MCP tool `sdd_cache_diff` que ejecuta `git diff base...HEAD` una vez y guarda el output en `.ai-internal/.cache/diff-{TICKET}.txt` con metadata en `.meta.json` (HEAD sha, base sha, ticket, createdAt). Cache key = ticket + HEAD sha; auto-regenera si HEAD avanza. Cleanup automático al transicionar a IDLE o cyclar a TICKETS desde COMPLETADO (best-effort, errores silenciados). Sanitiza el ticket ID con regex `[A-Za-z0-9_-]+` para evitar path traversal. Buffer máximo del diff = 50 MB. |
| **`/evidence`, `/update-docs`, `/commit` reusan el cache** | Los 3 comandos llaman `sdd_cache_diff` antes de re-correr git. Si `cached=true`, el diff ya está computado por un comando anterior del ciclo → cero trabajo. Fallback a `git diff` directo si el cache no está disponible (sin ticket activo, sin git, etc.). |
| **`sdd_get_state` recorta el log a 5 entradas por default** | `getState({fullLog?: boolean})` retorna `log` truncado a los últimos 5 entries (last-N) por default. Nuevo campo `logTotal` indica el tamaño real persistido. `sdd_get_state` expone `fullLog: true` como opt-in para debugging. El log completo sigue en `pipeline-state.json` (max 100 entradas) — solo se recorta el output del tool. |
| **Agents de Phase 0b devuelven JSON, no prosa** | Los 3 Explore agents de proyectos planos (`Stack & Dependencies`, `Arquitectura & Patrones`, `Calidad & Testing`) y los 3 agents de subproyectos monorepo (frontend, backend, unknown) tienen prompts reescritos con schema JSON explícito. El orquestador hace merge directo al perfil. `null` cuando un campo no se puede determinar (no omitir keys). Ahorro estimado: ~40% del payload de Phase 0b (~1500 tokens por bootstrap). |
| **Tests** | +5 tests cubren las semánticas del `log.slice(-5)` (preserva orden, maneja logs vacíos, no padding para logs cortos, fullLog devuelve completo). Total: 53 tests pasando (48 previos + 5 nuevos). El comportamiento dinámico de `cacheDiff` se valida vía build + smoke (requiere FS + git, fuera del alcance unit). |
| **Backwards-compat** | Cero breaking. `sdd_get_state` sin params devuelve menos data (positiva) — quien necesite el log completo pasa `fullLog: true`. El cache de diff es opt-in vía nuevo tool, no afecta flows existentes. Agents JSON: solo aplica a runs nuevos de Phase 0b; perfiles previos siguen siendo válidos (los campos del JSON son los mismos que la prosa cubría). |

## V4.16 — Integración Docusaurus con gate de docs crítica por ticket

| Cambio | Impacto |
|--------|---------|
| **Phase 0b — detección de Docusaurus** | Nuevo bloque `0.2c` busca `docusaurus.config.{js,ts,mjs,cjs}` con `find` (depth 4, excluyendo `node_modules`/`dist`/`build`/`.git`). Fallback: grep en `package.json` por `@docusaurus/core`. Si encuentra, parsea `path:` del config para resolver `docs_path` (default `docs`). Registra `DOCUSAURUS_DETECTED`, `DOCUSAURUS_ROOT`, `DOCUSAURUS_DOCS_PATH`, `DOCUSAURUS_HAS_SIDEBAR`. Proyectos sin Docusaurus: la detección retorna `false` y el flujo es idéntico a V4.15. |
| **Phase 0c — confirmación del usuario** | Nuevo paso `1.0d` (solo si detected): pregunta si habilitar el gate de docs crítica. Default recomendado = sí. Persiste `Docusaurus Enabled: true` + `Docusaurus Root` + `Docusaurus Docs Path` en `project-profile.md`. Si el user rechaza → no se escriben las keys (ausencia = deshabilitado, default-safe). |
| **MCP server — `ProjectConfig.docusaurus`** | Nuevo campo opcional en `types.ts`: `{root, docsPath, enabled, mode: "critical"}`. `config.ts` parsea las keys del profile con la misma estrategia que `Commit Style` (case-insensitive, 3 patrones de markdown). Si la key `Docusaurus Enabled` está ausente → `docusaurus` queda `undefined` (no gate). |
| **MCP server — nuevo gate EVIDENCIA → COMMIT** | `sdd_advance(COMMIT)` rechaza la transición si Docusaurus está habilitado y `data.docsDecision` no está registrado. Mensaje de error guía al uso de `/update-docs` + `sdd_register_docs_decision`. Proyectos sin Docusaurus: gate inactivo, comportamiento idéntico a V4.15. |
| **MCP server — nuevo tool `sdd_register_docs_decision`** | Acepta `{status: "updated"\|"skipped", reason: string (1-280 chars), files: string[]}`. Validaciones: razón obligatoria; `updated` requiere ≥1 archivo y verifica que cada archivo existe en disco; `skipped` rechaza si vienen archivos; máximo 20 archivos por decisión. Solo válido en estado EVIDENCIA. Registra en el log con detalle por tipo. |
| **Pipeline state — `docsDecision`** | Nuevo campo en `PipelineData` que se resetea en cycle restart (COMPLETADO→TICKETS) y en reset a IDLE. Expuesto en `getState` para que el menú pueda mostrar la decisión actual. |
| **Nuevo comando `/update-docs` — clasificador conservador** | `reusables/commands/update-docs.md` implementa la tabla de triggers (T1-T8): endpoint público nuevo, breaking change API, env var nueva, CLI nuevo, cambio de deploy/CI, webhook/evento nuevo, ruta de usuario nueva, migración DB. Anti-triggers explícitos: tests, lint, deps, comentarios, renames puros, archivos generados. **Default es skip**; documenta solo cuando hay trigger claro. Plantillas mínimas (sin marketing, sin "este PR", sin TOC/badges). Multi-target aware: routea a `services/{slug}/api.md` o equivalente según `targetSubproject`. |
| **Protecciones del clasificador** | NO toca `docusaurus.config.*` ni `sidebars.*` curados. NO escribe en `versioned_docs/` ni `i18n/`. NO ejecuta `npm run build`. Si el sidebar es manual y la carpeta destino no existe → skip con razón "carpeta no en sidebar curado". Si 5+ triggers disparan → warning al usuario (probablemente el ticket es demasiado grande). |
| **menu-template.md — integración EVIDENCIA** | Sección EVIDENCIA describe el gate y el flujo: `/update-docs` clasifica → muestra triggers detectados → confirma con `AskUserQuestion` antes de escribir → registra decisión. Si Docusaurus no habilitado, sección invariante. |
| **`project-vars.sh` — nuevas exports** | `SDD_DOCUSAURUS_ENABLED`, `SDD_DOCUSAURUS_ROOT`, `SDD_DOCUSAURUS_DOCS_PATH`. Disponibles para templates de Phase 2 y para `/update-docs`. Defaults seguros si keys ausentes. |
| **Bootstrap manifest + installer** | `install-bootstrap.sh` ahora copia `reusables/commands/update-docs.md` a `.ai-internal/reusables/commands/update-docs.md`. Manifest regenerado. Bump V4.14 → V4.16 (V4.15 fue solo de templates, sin cambios de installer). |
| **Backwards-compat estricta** | Proyectos pre-V4.16 sin `Docusaurus Enabled` en el profile → `docusaurus` queda undefined → ningún gate adicional → comportamiento exacto de V4.15. Re-ejecutar bootstrap en un proyecto existente: Phase 0b detecta Docusaurus si presente, Phase 0c pregunta si habilitar (opt-in explícito). |

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
