# Backlog — mejoras pendientes no implementadas

Items identificados durante el análisis cross-equipo de V4.9→V4.12 que **no se
implementaron** por priorización. Documentados acá para retomar sin re-analizar.

Prioridades:
- **P0** (crítico): bug que afecta funcionamiento. Implementar en próximo ciclo.
- **P1** (alto valor): mejora significativa, esfuerzo medio.
- **P2** (útil): mejora de UX/calidad, no urgente.
- **P3** (nice-to-have): refactor o hardening defensivo, baja probabilidad de impacto.

---

## P1 — alto valor

### Single Source of Truth para stack/framework
- **Estado actual**: 7 archivos contienen el stack del proyecto (CLAUDE.md, AGENTS.md, base-standards.mdc, {tipo}-standards.mdc, {tipo}-developer.md, openspec/config.yaml, project-profile.md). Cuando algo cambia (ej. Next.js 14→15), todos deben actualizarse. Riesgo de divergencia ALTO.
- **Propuesta**: CLAUDE.md como única fuente canonical (con frontmatter YAML estructurado). Los otros archivos REFERENCIAN ("Ver CLAUDE.md § Architecture") en lugar de copiar.
- **Trabajo**: refactor de los templates en phase-2-adapted.md.
- **Esfuerzo**: ~2 h.
- **Riesgo de implementación**: medio-alto (toca casi todos los archivos generados; conviene primero V4.14 con feature flag).

### Eliminar AGENTS.md (duplicado de CLAUDE.md)
- AGENTS.md es legacy — duplicado de CLAUDE.md. Algunos comandos lo referencian como fuente de "AGENTS.md § Language" pero ese contenido también vive en base-standards.mdc.
- **Riesgo**: rompe backwards-compat con proyectos pre-V4.14 que tienen AGENTS.md.
- **Estrategia gradual**: en V4.14 marcar como deprecated en todas las referencias; en V5.0 eliminar la generación; los proyectos lo borran manualmente cuando quieren.

### Rotación de docs/decisiones.md
- ADRs crecen sin límite. Después de 50+ se vuelve innavegable.
- **Propuesta**: estructura `docs/decisiones/{YEAR}.md` con README.md como índice. Rotación anual automática.
- **Esfuerzo**: ~30 min en /generate-docs Fase 3.

### Comando `/cleanup` para auditar transitorios huérfanos
- Detecta `.bootstrap-staging.*` viejos, `.compacted.claim.{PID}` con PID muerto, `.upgrade-pending` con >2h, `.bootstrap-backup/` con >3 backups.
- Reporta al usuario qué encontró + ofrece limpieza.
- **Esfuerzo**: ~45 min.

### Rotación de `.bootstrap-backup/`
- Hoy crece sin rotación con cada upgrade.
- **Propuesta**: mantener last-3 backups, eliminar el resto al inicio de cada upgrade.
- **Esfuerzo**: ~15 min en bootstrap.md.


### Activar versionado granular `sdd_version` en upgrade
- **Estado**: marcadores presentes en los 20 archivos de `reusables/` (frontmatter o `<!-- sdd-version: X.Y -->`), pero el flujo de upgrade en `phase-1-reusables.md` SIEMPRE sobrescribe.
- **Problema**: ediciones manuales del usuario en `.claude/commands/opsx/*.md` se pierden silenciosamente al re-ejecutar `/bootstrap`.
- **Trabajo**: en `phase-1-reusables.md`, comparar `sdd_version` de la fuente (`.ai-internal/reusables/x.md`) vs el destino instalado. Solo copiar si difieren. Log `[SKIP]` si igual.
- **Esfuerzo**: ~30 min, 20-30 líneas de bash.
- **Riesgo**: bajo (solo afecta upgrade, no instalación nueva).
- **Doc**: `REUSABLES_VERSIONING.md` ya describe el diseño; falta activarlo.

### QC agent post-Phase 2
- **Idea**: agent dedicado que LEE archivos generados por Phase 2 (Claude-written + sed) y valida:
  - Placeholders `__SDD_*__` y `{var}` sin reemplazar
  - Multi-target: cantidad de archivos generados == cantidad de slugs
  - Referencias cruzadas (ej. `plan-auth-service-ticket.md` referencia `auth-service-standards.mdc` que existe)
  - Frontmatter válido en `.mdc`
- **Reemplaza**: ~200 líneas de validación bash dispersa en phase-2-adapted.md.
- **Esfuerzo**: ~1.5 h.

### Tests MCP de gates con state mocks
- **Estado actual**: 34 tests, mayormente puros (`canTransition`, `isSafeBranchName`).
- **Faltan**: tests de `advance()` con state mockeado (sprint sin validar, multi-target sin target, etc.). Requiere mock de `loadState`/`saveState`.
- **Esfuerzo**: ~1 h con vitest mocks.

### Instant Bootstrap (curl|bash con cero preguntas)
- **Idea del Agent 6 UX**: `curl -fsSL .../instant-bootstrap.sh | bash` que corre install + Phase 0 con auto-respuestas (codebase, framework, tracker disponibles) + Phase 1-3 silenciosas. Tiempo total: 90-120s.
- **Reduce**: "tiempo a primera utilidad" de 30 min a 5 min.
- **Backwards-compat**: el flujo actual sigue funcionando.
- **Esfuerzo**: ~2 h.

---

## P2 — útil, no urgente

### Quick Start (50 líneas) + diagrama de flujo bootstrap
- README actual: 1000+ líneas. Onboarding fricciona.
- Propuesta: `QUICK_START.md` de 50 líneas en raíz. Diagrama Mermaid en `bootstrap.md` línea 1 mostrando "¿hay `.upgrade-pending`? → upgrade vs normal".
- Mover detalles internos a `docs/INTERNALS.md`.

### Mensajes de error MCP con paths absolutos
- En `pipeline.ts:registerEvidence()` y similares: el error muestra path relativo. Agregar `PROJECT_ROOT` para que el dev sepa qué ruta absoluta es inválida.
- Esfuerzo: 15 min.

### Aislar `npm install` del MCP server con rollback
- Hoy: `npm install` corre después de promover archivos del staging. Si falla, queda estado parcial sin rollback.
- Propuesta: try-catch bash. Si npm falla, revertir promoción.
- Esfuerzo: ~30 min.

### `confirmSprint` reset automático en TODOS los caminos a IDLE
- Hoy se limpia `sprintValidated` correctamente en IDLE-reset y COMPLETADO→TICKETS. Verificado.
- Pero conviene agregar test que cubra explícitamente: confirmSprint → advance(IDLE) → advance(TICKETS) → setActiveTicket debería FALLAR (sprint no validado).
- Esfuerzo: 15 min (solo test).

### Rename "Sprint Gate" → "Control de disponibilidad del ticket"
- En proyectos Kanban (Notion u otros sin sprints), el mensaje "no está en un sprint activo" asusta.
- Cambiar lenguaje a algo neutral: "Verificando si el ticket está listo para trabajar…"
- Esfuerzo: 30 min (search-replace en menu-template, README, y mensajes del MCP).

### Schema validation de SDD_SUBPROJECT_SLUGS en Phase 2
- Antes de generar archivos multi-target, validar:
  - Cada slug existe como variable `SDD_SUB_{SLUG_UPPER}_FRAMEWORK`
  - Cada path corresponde a directorio existente
  - Slugs son kebab-case válido
- Esfuerzo: ~30 min.

### Hook `multiTargetMode` parser case-insensitive
- `config.ts:96` asume `"true"` literal. `"True"` o `"TRUE"` falla a `false` silenciosamente.
- Fix: `multiTargetRaw.toLowerCase() === "true"` (ya hecho actualmente — verificar). Si no, agregar test.

---

## P3 — hardening defensivo

### GPG signing del manifest SHA-256
- **Limitación actual**: manifest se descarga del mismo repo que los archivos. Insider con write access compromete ambos.
- **Mitigación real**: firmar manifest con clave GPG del mantenedor; instalador valida con `gpg --verify`. Fallback a unsigned si GPG no disponible.
- **Esfuerzo**: ~1 h cliente + setup PGP key del mantenedor.
- **Vale la pena si**: alguien más lleva mantenimiento del repo o se distribuye internamente con riesgo de compromiso.

### Race condition post-compact con múltiples sesiones simultáneas
- Si dos Claude Code corriendo en el mismo proyecto compactan al mismo tiempo, el atomic `mv` claim puede ejecutar el reminder en uno mientras el otro lo pierde.
- Mitigación: documentar la limitación en `post-compact-reminder.sh` o usar lock file con `flock`.
- Probabilidad real: muy baja. No bloqueante.

### Endurecer regex `isSafeBranchName` para rechazar branches que empiezan con `-`
- Hoy permite `-foo` (podría ser parseado como flag por execFileSync).
- Con `execFileSync` (array form) no es vulnerable, pero defensa en profundidad.
- Cambio: regex `^[A-Za-z0-9._]([A-Za-z0-9._/-]*)?$`.
- Esfuerzo: 5 min + ajustar test.

### Soporte multi-target con ticket cross-servicio (V5.0+)
- Hoy: 1 ticket = 1 servicio (regla acordada en V4.10).
- Si la práctica lo pide, evolucionar a array `targetSubprojects` y loop secuencial en `/develop`.
- Solo abordar si hay demand real.

---

## Ítems analizados pero descartados

### Trocear `phase-2-adapted.md` (35KB)
- Análogo a lo que se hizo con phase-0. Razón para no hacerlo todavía: phase-2 es ejecutado en una sola fase de `/bootstrap`, mientras que phase-0 tiene sub-fases naturales (detección de MCPs, codebase, confirmación). Trocear phase-2 sería refactor sin ganancia clara para LLM.

### Sistema de includes en templates (jinja2 / handlebars)
- Análisis Agent 2 sugería reemplazar `__SDD_*__` + `{var}` por templating engine único.
- Descartado: agrega dependencia (Python o Node) al instalador shell. El sistema actual funciona aunque sea verboso.

### Eliminar pregunta de target subproject completamente (V4.12 lo hizo opt-in con auto-detect)
- Auto-detección por `git diff` (V4.12) es buen balance: sugiere pero no impone. Eliminar la pregunta sería arriesgado en casos donde el dev cambia de servicio mid-flow.

---

## Cómo retomar

1. Leer este archivo + `CHANGELOG.md` para contexto histórico.
2. Elegir un item según prioridad y esfuerzo disponible.
3. Implementar + test + bump versión + manifest + commit + push.
4. Mover el item a `## Done en V4.X` al final de `BACKLOG.md` cuando se complete.

---

## Done en V4.14

- **Modo respeto de configuración preexistente** (ADR-008): detección defensiva
  de `.claude/` preexistente, Nx/pnpm-workspace aware, preserve mode para
  `CLAUDE.md` curados, adaptador Conventional Commits en `/commit`. Habilita
  instalar SDD en repos maduros como ADAM360 sin pisar trabajo del equipo.
