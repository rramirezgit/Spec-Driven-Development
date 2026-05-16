<!-- sdd-version: 1.0 -->
# Role
Orquestador batch que ejecuta un lote de tickets con autonomía limitada y
**puntos de pausa concretos** en zonas de riesgo. No es yolo: cada ticket pasa
por pre-flight, se ejecuta el cycle completo (DoR → branch → develop →
auto-verify → evidence → commit), y solo se pausa al humano cuando hay señal
clara de riesgo o falla.

> **Filosofía**: throughput sin sacrificar gates de seguridad. El humano no
> aprueba paso-a-paso; aprueba **una vez al final** (modo `auto-merge-final`),
> o ante un evento específico (modo `supervised`). El reporte de seguridad
> al final lista cualquier cosa peligrosa que el agent detectó.

# Cuándo se invoca

- `/goal sprint` — todos los tickets del sprint activo del tracker (modo supervised).
- `/goal sprint --auto-merge` — sprint completo con merge batch al final.
- `/goal AUTH-1,AUTH-2,AUTH-3` — solo esos tickets.
- `/goal AUTH-1,AUTH-2 --yolo --i-accept-the-risks` — yolo con dos flags (no slip).
- `/goal-resume` — continúa un batch pausado.

# Process

## 0. Resolver lista de tickets

- `sprint` → fetch sprint activo del tracker (Jira/Notion según config).
- IDs → usar literal.
- Validar: cada ID matchea `[A-Z]+-[0-9]+` (o similar según tracker). Sanitizar.

## 1. Mostrar al usuario el plan del batch

```
🎯 /goal — batch supervisado

Tickets (5):
  1. AUTH-101 — Login con Google
  2. AUTH-102 — Refresh token rotation
  3. PAY-50  — Cambio en cálculo de IVA
  4. UI-77   — Nuevo screen perfil
  5. UTIL-12 — Helper de format-date

Modo: {supervised | auto-merge-final | yolo}

¿Iniciar el batch?
```

**AskUserQuestion**: "Sí, iniciar" / "Revisar lista" / "Cancelar".

Si confirma → `sdd_register_goal({tickets, mode})`.

## 2. Iteración por ticket

Para cada ticket, en orden:

### 2.1. Sprint gate

Verificar que el ticket esté en sprint activo (idéntico al flow normal).
- Si no está en sprint → `sdd_update_goal_progress(ticketId, 'skipped', 'No está en sprint activo')` y continuar al siguiente.

### 2.2. Pre-flight check

Fetch el ticket. Analizar:

| Check | Si falla → |
|-------|-----------|
| **DoR validation** | `sdd_validate_ticket_dor`. Si `failed` y mode≠yolo → **pausar**: `sdd_update_goal_progress(ticketId, 'paused', 'DoR failed: <errors>')` + ofrecer al user correr `/refine-ticket {ID}`. |
| **Risk level** | `sdd_classify_risk` sobre paths esperados + descripción. Si `high` y mode=supervised → mostrar reasons al user, AskUserQuestion: "Procedo igual / Pausar para review". En auto-merge-final → procede pero registra para reporte final. En yolo → frena: HIGH es non-negociable, paso a `paused` con razón "HIGH risk en modo yolo — non-negociable". |
| **Paths sensibles explícitos** | Si el plan va a tocar `auth/`, `payment/`, `migration/`, `secrets/` → forzar pausa salvo en supervised con confirmación explícita del user. |
| **Test cases declarados** | El ticket debe tener ≥3 test cases (validado por DoR). Si no → forzar `/refine-ticket`. |

Si pre-flight passes → marcar `sdd_update_goal_progress(ticketId, 'in_progress')`.

### 2.3. Ejecutar cycle completo

Para el ticket que pasó pre-flight:

1. **Sprint gate** → `sdd_confirm_sprint`
2. **Set active ticket** → `sdd_set_active_ticket(ID)`
3. **Multi-target target** (si aplica) → auto-detectar o preguntar 1 vez
4. **DoR validation** → ya hecho en pre-flight, reusar
5. **Crear branch** → `feature/{ID}-{slug}` + `sdd_register_branch`
6. **`sdd_advance(PLAN)`**
7. **Ejecutar `/plan-{tipo}-ticket {ID}`** → genera plan técnico
8. **`sdd_advance(IMPLEMENTACION)`**
9. **Ejecutar `/develop-{tipo} {ID}`** → implementa según plan
10. **Auto-verify** (si habilitado en project profile):
    - Correr `/auto-verify` → `sdd_register_auto_verification(...)`
    - Si `failed` y `autoVerify.enforced=true` → **pausar**: `sdd_update_goal_progress(ticketId, 'paused', 'Auto-verify fail: <blockers>')`. El user puede resolver manualmente y continuar con `/goal-resume`.
    - Si `inconclusive` → continuar (degrade gracefully).
    - Si `passed` o `skipped` → continuar.
11. **Verificación humana** (siempre, salvo yolo): mostrar resumen breve + `sdd_confirm_implementation`. En modo `supervised`/`auto-merge-final`, esta confirmación SÍ se pregunta — es el único gate humano por ticket.
12. **`sdd_advance(EVIDENCIA)`**
13. **Ejecutar `/evidence`** → genera `docs/evidence/{ID}.md`
14. **Update-docs si Docusaurus habilitado** → `/update-docs` → `sdd_register_docs_decision`
15. **`sdd_advance(COMMIT)`**
16. **Commit local** (sin push) → `/commit` con flag para NO pushear ni mergear todavía
17. **`sdd_advance(COMPLETADO)`** + `sdd_update_goal_progress(ticketId, 'completed')`

### 2.4. Manejo de errores irrecuperables

Si en cualquier paso falla algo que no es recuperable (ej. tests del proyecto rotos después de develop, conflicts de git en branch, etc.):
- `sdd_update_goal_progress(ticketId, 'failed', '<error>')`
- Continuar al siguiente ticket (no abortar todo el batch).

## 3. Reporte final + decisión de merge

Cuando todos los tickets están en estado terminal (`sdd_get_state` retorna `goalSession.finishedAt != null`):

```
🎯 Goal completado: 7/10 tickets

✅ COMPLETED (listos para merge):
   AUTH-101 — Login con Google           [LOW risk, smoke ✅]
   AUTH-102 — Refresh token rotation     [HIGH risk, smoke ✅, review extra]
   UI-77    — Nuevo screen perfil        [MEDIUM, smoke ✅]
   UTIL-12  — Helper format-date         [LOW, sin auto-verify]

⏸️ PAUSED (necesitan tu atención):
   PAY-50  — Cambio en cálculo IVA      [pre-flight: toca payment/]
   AUTH-89 — Migración tabla users      [pre-flight: migration]
   API-22  — Endpoint /users/bulk-del   [HIGH risk + delete operation]

❌ FAILED:
   - (ninguno)

🛡️ REPORTE DE SEGURIDAD:
   AUTH-101 modificó AuthMiddleware.ts — code path no-autenticado sin tests adicionales.
   AUTH-102 hardcodeó secret en config — revisar si va a env var.
   UI-77 — sin red flags.
   UTIL-12 — sin red flags.
```

Si modo = `auto-merge-final`:
- AskUserQuestion: "¿Mergeo los completed a dev?" → "Todos / Uno por uno / Solo X / Ninguno"
- Para cada aprobado: `git checkout dev && git merge feature/{ID}-* --no-ff` + push.

Si modo = `supervised`:
- Mostrar las branches locales listas y el comando `git merge` que el dev correría. No mergear automáticamente.

Si modo = `yolo`:
- **NO push automático** (esto es non-negociable). Mostrar dashboard y dejar que el dev haga push manual.

## 4. Si hay tickets pausados → `/goal-resume`

Mostrar al user:

```
Goal sigue con 3 tickets pausados:
  - PAY-50  (paused: toca payment/)
  - AUTH-89 (paused: migration detectada)
  - API-22  (paused: HIGH + delete)

Para retomarlos: /goal-resume
O resolvelos manualmente fuera de /goal y descartá el batch con sdd_abort_goal.
```

## 5. Protecciones non-negociables

Aún en yolo, las siguientes nunca se relajan:

1. **Nunca push automático a remoto.** Commits locales sí; push manual del dev.
2. **Nunca merge a `main`/`master`/`production`.** Feature → dev solamente.
3. **Si 2 tickets seguidos fallan en auto-verify** → abort del batch.
4. **Si tests del proyecto (npm test) se rompen al terminar un ticket** → abort del batch.
5. **Nunca tocar paths bloqueados explícitamente**: `.env`, `secrets/`, `migrations/` sin DoR completa.
6. **Reporte de seguridad final SIEMPRE se genera** — yolo no lo skippea.

# Modos en detalle

## supervised (default)

- Pre-flight pause: sí (DoR fail, HIGH risk con confirmación).
- Verificación humana per-ticket: **sí** (1 AskUserQuestion por ticket en step 11).
- Auto-merge final: **no** (commits locales, dev mergea a mano).
- Apto para: equipos que recién están adoptando /goal.

## auto-merge-final

- Pre-flight pause: sí (igual que supervised).
- Verificación humana per-ticket: **sí** (no se elimina).
- Auto-merge final: **sí** (con review dashboard al final).
- Apto para: sprints de tickets bien definidos.

## yolo (con safeguards)

- Pre-flight pause: solo para HIGH risk + paths bloqueados (non-negociable).
- Verificación humana per-ticket: **no** (se confía en auto-verify + smoke tests proyecto).
- Auto-merge final: **no** (commits locales, push manual).
- HIGH risk: **bloqueante** (yolo no significa imprudente).
- Apto para: tickets de scope LOW conocido en equipos maduros.

# Rules

- Sanitizar IDs antes de cualquier git/MCP call.
- **Nunca anidar /goal**: si hay sesión activa, error.
- **Nunca saltar Sprint Gate** ni el DoR strict gate del MCP server.
- **Cada ticket = su propia rama**: `feature/{ID}-slug`.
- **Reporte final OBLIGATORIO** sin importar el modo.
- **Logs**: cada transición de ticket queda en `pipeline-state.json` log para auditoría.
