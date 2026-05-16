<!-- sdd-version: 1.0 -->
# Role
Product Owner liaison. Refina un ticket existente para que cumpla con el schema
de Definition of Ready (V4.18) sin re-explorar el codebase ni inventar contexto.
A diferencia de `/enrich-ticket` — que enriquece con contexto técnico explorado —
`/refine-ticket` es **puramente interactivo**: identifica los huecos del schema
y le pregunta al usuario lo que falta, una tanda de preguntas, sin pretender
saber la respuesta.

> Casos de uso típicos:
> - Ticket creado fuera de SDD (PO escribió directo en Jira) que no pasa el DoR.
> - Ticket pre-V4.18 que cumplía el schema viejo pero le falta secciones nuevas.
> - Ticket que enrich procesó pero todavía tiene gaps que requieren input humano.

# Arguments
`$ARGUMENTS` — Ticket ID (obligatorio).

# Process

## 1. Fetch ticket

**Preflight**: Verificar MCP del tracker disponible.
Si no: pedir al usuario que pegue el body completo del ticket.

Fetch ticket `$ARGUMENTS` vía MCP del tracker.

## 2. Validar contra DoR

```
sdd_validate_ticket_dor({
  ticketId: $ARGUMENTS,
  body: <body del ticket>
})
```

Del response, extraer `detail.sections` (presencia de las 8 secciones) y
`detail.errors` / `detail.warnings`.

> **Si validation.status === "passed"** → mostrar al usuario "✅ Ticket ya cumple DoR. Nada que refinar." y salir.

## 3. Identificar secciones que faltan o están incompletas

Secciones obligatorias y sus reglas:

| Sección | Regla | Pregunta interactiva si falta |
|---------|-------|-------------------------------|
| Objetivo | 1-2 frases lenguaje producto | "¿Qué problema concreto resuelve este ticket para el usuario o sistema? Incluí métrica si tenés." |
| Contexto técnico | módulos/archivos/patrones | "¿Qué módulos o archivos del codebase toca este ticket? Si ya están en el plan, listalos; si no sabés, dejá 'TBD' explícito." |
| Criterios de aceptación | ≥2 GWT, sin vague | "¿Cuáles son los criterios de aceptación? Formato Dado/Cuando/Entonces, mínimo 2. Sin 'correctamente', 'intuitivo'." |
| Fuera de scope | ≥1, no "nada" | "¿Qué queda EXPLÍCITAMENTE fuera de este ticket? Mínimo 1 ítem — 'nada' no vale." |
| Dependencias | tickets/decisiones/servicios | "¿Hay tickets bloqueantes? ¿Decisiones pendientes? ¿Servicios externos requeridos?" |
| Riesgos | ≥1 ítem | "¿Qué podría romperse? perf / seguridad / datos sensibles / breaking changes / migrations? (mínimo 1)" |
| Test cases declarados | ≥3 | "¿Cuál es el golden path + 2 edge cases que debe cubrir? Mínimo 3 casos." |
| Definition of Done | ≥3 ítems | "¿Cuáles son los criterios objetivos para considerarlo terminado? Mínimo 3 (incluyendo tests + docs si aplica)." |

## 4. Preguntar al usuario en UNA tanda

**Usar AskUserQuestion con máximo 5 preguntas a la vez.** Si faltan más de 5 secciones, priorizar:
1. Errors antes que warnings.
2. Secciones más downstream: Test cases > Criterios > Out of scope > resto.

> **Si una sección está presente pero con warnings** (ej. AC con lenguaje vago):
> mostrar al usuario el contenido actual + la sugerencia + preguntar si la reescribe ahora o lo deja para más tarde.

## 5. Construir el body refinado

Reglas:
- **Conservar todo lo que ya estaba bien**.
- **Agregar/reemplazar solo lo respondido por el usuario**.
- Marcar las secciones nuevas con `[Added by /refine-ticket — {fecha}]` al final.
- **No inventar**: si el usuario dejó "TBD" en una sección, dejar "TBD" — el validator lo va a flaggear de nuevo y eso es información honesta.

## 6. Mostrar diff antes de actualizar

Antes de escribir al tracker:

```
🔧 Refine — cambios a aplicar a {TICKET_ID}:

Secciones agregadas:
  + Objetivo
  + Test cases declarados
  + Fuera de scope

Secciones reescritas (con vague language):
  ~ Criterios de aceptación

¿Aplico los cambios al ticket en __SDD_TRACKER__?
```

**AskUserQuestion**: "Sí, aplicar" / "Revisar diff completo" / "Cancelar".

## 7. Update ticket vía MCP

Si MCP del tracker disponible: actualizar via tool del tracker.
Si no: output el body refinado para que el dev pegue manual.

## 8. Re-validar

```
sdd_validate_ticket_dor({ticketId, body: <body refinado>})
```

Reportar al usuario:

```
✅ Refine completado.
   Status: {passed | warned}
   Sections: 8/8 presentes
   Errors restantes: {N}
   Warnings restantes: {N}
```

Si todavía hay errors → mostrarlos. El user puede correr `/refine-ticket` de nuevo.

## 9. Si el ticket es hotfix legítimo

Si el branch actual o el issuetype indica hotfix (`hotfix/*`, issuetype=Hotfix),
ofrecer al usuario:

```
🚨 Ticket detectado como hotfix.
¿Bypass el resto del DoR validation con razón explícita?
```

Si sí: `sdd_validate_ticket_dor({skip: true, skipReason: "..."})`.

# Rules

- **Escribir en __SDD_IDIOMA_TICKETS__**.
- **No inventar contexto** — preguntar al usuario; si no sabe, dejar "TBD".
- **No re-explorar el codebase** — eso es trabajo de `/enrich-ticket`.
- **No tocar contenido fuera del schema DoR** — descripciones del Como/Quiero/Para, sub-tasks, comentarios: intactos.
- **Hotfix**: ofrecer bypass; nunca aplicar silenciosamente.
- **Una tanda de preguntas**, máx 5 — si hay más, priorizar errors críticos y dejar warnings para una segunda corrida.

# Diferencia con `/enrich-ticket`

| `/enrich-ticket` | `/refine-ticket` |
|------------------|------------------|
| Explora el codebase (Grep/Glob/Read) | NO toca el codebase |
| Completa con contexto técnico inferido | Solo agrega lo que el usuario responde |
| Puede correr autónomamente | Siempre interactivo (AskUserQuestion) |
| Output: ticket con paths/patterns reales | Output: ticket con respuestas humanas |
| Usar cuando: ticket existe pero no tiene contexto técnico | Usar cuando: ticket existe pero falla DoR y el agent no puede inferir |

Recomendación: correr `/enrich-ticket` primero (completa lo inferible), después
`/refine-ticket` para los gaps que solo el humano puede llenar.
