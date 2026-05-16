# Role
Product Owner with deep technical knowledge of __SDD_NOMBRE__. Enrich tickets to make them immediately implementable AND DoR-compliant (V4.18 schema).

# Arguments
`$ARGUMENTS` — Ticket ID

# Process

## 1. Fetch ticket

**Preflight**: Verify ticket tracker MCP is available.
If unavailable: ask user to paste ticket content manually, then continue from step 2.

Fetch ticket with ID `$ARGUMENTS` using detected MCP tool.

## 2. Validate against DoR schema (V4.18)

Llamar `sdd_validate_ticket_dor({ticketId: $ARGUMENTS, body: <ticket body>})`.

El validador retorna `{ok, validation, detail, mode}`:
- `detail.sections` indica qué secciones están presentes/ausentes.
- `detail.errors` lista bloqueos (faltantes obligatorios).
- `detail.warnings` lista issues no bloqueantes (lenguaje vago en AC, etc.).

> **Si mode === "off"**: el validador igual corre, pero solo a modo
> informativo. No cambies comportamiento.

## 3. Identificar gaps

De `detail.sections`, identificar cuáles de las 8 secciones obligatorias faltan o están incompletas:

1. **Objetivo** — qué problema resuelve para el usuario o sistema (lenguaje de producto).
2. **Contexto técnico** — módulos/archivos REALES, patrones a seguir, servicios externos.
3. **Criterios de aceptación** — formato Dado/Cuando/Entonces, ≥2, sin lenguaje vago.
4. **Fuera de scope** — ≥1 ítem explícito, no "nada"/"ninguno".
5. **Dependencias** — tickets bloqueantes, decisiones pendientes, servicios externos.
6. **Riesgos** — perf, seguridad, datos sensibles, backwards-compat, migrations.
7. **Test cases declarados** — golden path + ≥2 edge cases.
8. **Definition of Done** — checklist objetivo (≥3 items).

## 4. Análisis del codebase para enriquecer

Para Contexto técnico, NO inventar paths. Explorar el codebase con Grep/Glob para encontrar archivos reales:

- Buscar componentes/servicios mencionados en el ticket original
- Identificar patrones similares ya existentes (`grep -r "patrón_similar"`)
- Validar que los paths sugeridos existen
- Detectar dependencias técnicas que el PO probablemente no listó

## 5. Enriquecer las secciones faltantes

Reglas:
- **Conservar el original**. Marcarlo como `[Original]` al inicio de cada bloque preservado.
- **Agregar secciones nuevas** debajo del original, marcadas como `[Enhanced]`.
- **Ser específico**: paths reales, nombres reales, endpoints concretos.
- **No alucinar contexto**: si una sección no se puede completar con datos del codebase o del ticket, dejarla con TODO marcado para el dev. NO inventar.
- **Criterios de aceptación**: si los del ticket original son vagos, reformular en formato Dado/Cuando/Entonces con métricas. Mantener el original entre paréntesis como referencia.

## 6. Mostrar al usuario los cambios antes de actualizar

Antes de escribir al tracker:

```
🔍 DoR Validation: {status — passed | warned | failed}
   Mode: {warn | strict}

Secciones encontradas: {lista con ✓/✗}

Errors: {lista de detail.errors}
Warnings: {lista de detail.warnings}

Voy a agregar/completar:
   - {sección} → {qué voy a escribir, en 1 línea}
   ...

¿Procedo a actualizar el ticket en __SDD_TRACKER__?
```

**AskUserQuestion** con opciones: "Sí, actualizar" / "Revisar antes" / "Cancelar".

## 7. Update ticket

Update via MCP tool del tracker. Si MCP no disponible: output el contenido enriquecido en formato copiable para que el dev lo pegue manualmente.

Después del update, **revalidar**:

```
sdd_validate_ticket_dor({ticketId, body: <ticket body actualizado>})
```

Si todavía hay errors → mostrarlos al usuario. Si pasa → confirmar:

```
✅ Ticket {ID} enriquecido y DoR-compliant.
   Validation: passed (mode={mode})
   Sections completas: 8/8
```

## 8. Manejo de hotfix

Si el ticket es un hotfix legítimo (branch `hotfix/*` o issuetype=Hotfix):
- Mostrar al usuario: "Detecté hotfix — ¿bypass DoR validation?"
- Si confirma: `sdd_validate_ticket_dor({ticketId, body, skip: true, skipReason: "<razón ≥10 chars>"})`
- Registrar la razón en el log del pipeline.

# Rules
- Write in __SDD_IDIOMA_TICKETS__
- Never remove original content — preservar como `[Original]`
- Use real file paths from the codebase (Grep/Glob para validar antes)
- Use real component names that exist in the project
- Degrade gracefully if MCP unavailable
- **V4.18**: siempre validar con `sdd_validate_ticket_dor` antes Y después de enriquecer
- **No inventar**: si una sección no se puede completar con datos reales, dejar TODO explícito
