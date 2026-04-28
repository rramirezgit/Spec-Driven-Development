# Decisiones arquitectónicas — ADRs cortos

Registro de decisiones de diseño tomadas durante la evolución del proyecto.
Cada ADR explica **qué** decidimos, **por qué**, y **qué alternativas descartamos**.

Sirve como contexto para futuras iteraciones — sin esto, una compactación o
un mantenedor nuevo perdería el "por qué" detrás de cada decisión.

---

## ADR-001: Plantilla estándar de evidencia en lenguaje no técnico (V4.9)

**Decisión**: el comentario que se publica al ticket al transicionar a QA es
una plantilla **fija** con dos secciones: "📋 Qué se hizo" y "🧪 Cómo probarlo".
Ambas en lenguaje no técnico, sin nombres de archivos, librerías, endpoints
ni rutas de código. Misma plantilla para todos los tipos de proyecto.

**Por qué**:
- Los comentarios técnicos previos (con tabla de archivos, endpoints, links a
  Figma/screenshots) eran ilegibles para QA y PM no técnicos.
- QA solo necesita: qué probar y cómo.
- Eliminamos los gates obligatorios de Figma y screenshot porque añadían
  fricción sin proporcionar valor real al QA.

**Alternativas descartadas**:
- Mantener templates separados para backend/frontend/fullstack (más mantenimiento,
  resultado igualmente técnico).
- Dejarlo libre y que cada dev escriba como quiera (inconsistencia, mala UX QA).

**Implementación**: `reusables/commands/commit.md` §7.3.

---

## ADR-002: Multi-target opt-in, no automático (V4.10)

**Decisión**: cuando Phase 0 detecta N≥3 subproyectos o 2 del mismo tipo,
**preguntar al usuario** si quiere modo multi-target (un set de comandos por
subproyecto) o modo simple (tratarlo como un único proyecto).

**Por qué**:
- Multi-target añade complejidad (1 pregunta por ticket, N archivos generados,
  tabla de servicios en CLAUDE.md) que no todos los proyectos necesitan.
- Para un proyecto con `app-front/` + `app-back/` clásico, el modo
  fullstack-clásico (frontend/backend) es más simple y suficiente.
- Para microservicios reales (5+ servicios), multi-target es imprescindible.
- Backwards-compat estricta: 1 front + 1 back **siempre** genera
  `frontend`/`backend` (no se rompen proyectos ya bootstrappeados).

**Alternativas descartadas**:
- Auto-activar multi-target si N≥2 (rompe backwards-compat).
- Hacer multi-target el modo único (penaliza casos simples).
- Soportar arrays de targets por ticket (V5.0+ si la práctica lo pide).

**Implementación**: `phase-0c-confirm.md §1.0`, `phase-2-adapted.md`
generación dual.

---

## ADR-003: 1 ticket = 1 subproyecto en multi-target (V4.10)

**Decisión**: cada ticket apunta a **UN solo** subproyecto. Cambios que tocan
varios servicios se splittean en sub-tickets, uno por servicio.

**Por qué**:
- Trazabilidad de QA: el comentario al ticket describe lo que se cambió en UN
  servicio. Si cambia 5, el comentario se vuelve ilegible.
- Ramas feature suelen ser de scope acotado; cross-servicio es señal de mal split.
- Estado del pipeline más simple (`targetSubproject: string`, no array).

**Alternativas descartadas**:
- Permitir array `targetSubprojects` con loop secuencial en `/develop`. Más
  potente pero más complejo. Postponed a V5.0+ si hay demand real.

---

## ADR-004: Teams de Explore agents para análisis y documentación, NO para escritura de código (V4.12)

**Decisión**:
- ✅ **SÍ** team paralelo en: `/evidence`, `/generate-docs`, Phase 0b
  (análisis de codebase).
- ⚠️ **Team de soporte** (consultivo, no escribe) en: `/review-pr`,
  potencialmente `/develop`.
- ❌ **NO** team en: `/develop` (escritura), `/commit`, `/release-to-main`,
  `/plan-ticket`.

**Por qué**:
- Lectura + análisis + redacción a directorios disjuntos = paralelizable
  sin conflictos (espacios de escritura exclusivos por agent).
- Escritura de código simultánea = conflictos de archivos, race conditions,
  pérdida de consistencia.
- Transacciones git (`/commit`, `/release-to-main`) requieren orden
  estrictamente lineal; paralelizar = corrupción del repo.
- Decision-heavy commands (`/plan-ticket`) requieren razonamiento secuencial;
  splittear los confunde.

**Regla mental para futuras decisiones**: *"agents que LEEN y REPORTAN se
paralelizan; agents que ESCRIBEN código en archivos compartidos no"*.

**Implementación**:
- `/evidence`: 2 agents (`docs/evidence/` vs `docs/api+components/`).
- `/generate-docs`: 3 fases con team en F1 y F2, secuencial en F3.
- Phase 0b: 3 agents en proyectos planos, N agents (uno por subproject) en
  monorepos.

---

## ADR-005: Hook permisivo + confirmación interactiva en /commit (V4.11)

**Decisión**: el hook `guard-dangerous-ops.sh` **NO** bloquea `git push` a
`dev` ni a feature branches. La confirmación (AskUserQuestion) se hace en
`/commit` antes de cada push.

**Por qué**:
- El bloqueo previo era too aggressive: impedía push hasta a `dev`, forzando
  al usuario a desactivar el hook o reescribir el comando.
- El hook sigue siendo defensa profunda contra acciones realmente
  destructivas: push a `main`/`master` (incluyendo refspec bypass como
  `HEAD:main`), `--force`/`-f`, `reset --hard`, `clean -f`.
- La confirmación interactiva en `/commit` es el lugar natural: el usuario
  ve el resumen del cambio antes de aprobar.

**Alternativas descartadas**:
- Bloquear todo push (V4.10 — too aggressive).
- Permitir todo sin confirmación (riesgo de push autónomo no deseado).

---

## ADR-006: Manifest SHA-256 sin firma GPG (V4.9)

**Decisión**: el instalador valida cada archivo descargado contra hashes
SHA-256 en `bootstrap-manifest.json`, pero **el manifest no está firmado
con GPG**.

**Por qué**:
- El manifest mitiga **MITM en tránsito** y **corrupción de descarga**
  (cache stale, proxy modificando contenido, HTTP 404 con HTML).
- **No mitiga** insider threat (atacante con write access al repo
  modifica archivos + manifest juntos).
- GPG signing requiere infra adicional (clave del mantenedor, distribución,
  validación cliente). Esfuerzo desproporcionado para el modelo de riesgo
  actual (repo privado, mantenedor único).

**Cuándo revisar**: si el proyecto se distribuye más ampliamente o pasa a
multi-mantenedor, agregar GPG signing (item P3 en BACKLOG).

---

## ADR-007: Phase 0 troceada en 3 sub-archivos (V4.9)

**Decisión**: `phase-0-detect.md` original (46 KB monolítico) dividido en:
- `phase-0a-mcps-tracker.md` — openspec, MCPs, elección y config de tracker
- `phase-0b-codebase.md` — CLAUDE.md previo, monorepo, team analysis
- `phase-0c-confirm.md` — preguntas, confirmación, persistencia

**Por qué**:
- Un archivo de 46 KB con 5 responsabilidades distintas es frágil para LLM
  (instrucciones se pisan, condicionales anidadas, riesgo de seguir un
  branch equivocado).
- Sub-archivos con responsabilidad única son más legibles y mantenibles.
- `phase-0-detect.md` queda como orquestador delgado (4 KB).
- V4.12 agregó `.phase-state.json` como handoff explícito entre las 3
  sub-fases (cada una valida que la previa completó).

**Alternativas descartadas**:
- Mantener todo en un archivo con índice claro (mejora navegación pero no
  resuelve el problema de fragilidad para el LLM).
