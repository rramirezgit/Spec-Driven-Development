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
