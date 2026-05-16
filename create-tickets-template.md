<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNC BUDDY: create-tickets-template-notion.md
Contrato compartido: create-tickets-shared.md
Steps 0, 2-5, 7 y "Reglas" deben mantenerse alineados con su buddy.
Cambios en secciones marcadas como compartidas → actualizar AMBOS templates.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->

# Role
Product Owner experto. Tickets claros y completos en __SDD_IDIOMA_TICKETS__, listos para implementar.

# Arguments
`$ARGUMENTS` — Path a artefacto, nombre de OpenSpec change, o descripción.

# Process

## Step 0: Preflight — verificar MCP disponible

```bash
# El MCP de __SDD_TRACKER__ debe estar disponible
```

Si el MCP no está disponible:
```
⚠️ El MCP de __SDD_TRACKER__ no está disponible.
Opciones:
1. Configuralo siguiendo: [URL de docs]
2. Generó los tickets como texto para que los crees manualmente
```
Preguntar al usuario qué prefiere. Si elige texto: generar todo el contenido pero sin llamadas MCP, en formato copiable.

## Step 1: Contexto del proyecto
Obtener proyectos disponibles con cloudId `__SDD_CLOUD_ID__` (si Jira).
Si múltiples proyectos: preguntar en cuál crear.

## Step 1b: Detectar assignee y sprint activo

1. **Obtener usuario actual** — Llamar `atlassianUserInfo` (con el `atlassian_prefix` detectado).
   Guardar `accountId` del usuario autenticado.

2. **Obtener sprint activo** — Llamar `searchJiraIssuesUsingJql` con:
   `project = __SDD_PROJECT_KEY__ AND sprint in openSprints() ORDER BY created DESC`
   y `fields: ["sprint"]`.
   Del resultado, extraer el sprint activo (campo `sprint` con `state: "active"`).
   - Si hay sprint activo → guardar `sprint.id` y `sprint.name`
   - Si no hay sprint activo → **BLOQUEAR**:
     ```
     ❌ No hay un sprint activo en el proyecto __SDD_PROJECT_KEY__.

     Los tickets deben crearse dentro de un sprint activo.
     Creá o activá un sprint en Jira y volvé a intentar.
     ```

3. **Preguntar assignee** — AskUserQuestion (single_select):
   ```
   ¿A quién se asignan los tickets?

   1. A mí ({nombre del usuario actual})
   2. Sin asignar (asignar después en Jira)
   3. A otra persona (buscar por nombre/email)
   ```
   - Si elige "otra persona" → preguntar nombre/email → `lookupJiraAccountId` → confirmar match

## Step 2: Leer fuente
- Path → leer archivo
- Change OpenSpec → leer `openspec/changes/<name>/` artifacts
- Texto libre → usar directamente

## Step 3: Diseñar estructura
- **Epic** (opcional): para features con múltiples stories
- **Stories**: una por funcionalidad / flujo de usuario
- **Sub-tasks**: tareas técnicas específicas

## Step 3b: Cargar decisiones del change + clasificar riesgo por ticket (V4.19)

```
sdd_get_state()
```

Del response, extraer:
- `changeDecisions[]` — decisiones tomadas en menu Opción 1 durante el gap analysis.
- `changeRisk` — clasificación global del change.

> **Si `changeDecisions` está vacío**: el feature no pasó por el gap analysis
> de Opción 1. Eso solo debería ocurrir en flows manuales (creación directa
> de tickets sin `/menu`). Procedé igual pero **avisá al usuario** que el
> proceso recomendado es vía `/menu` Opción 1 para preguntas batch.

Para CADA Story que vas a crear, antes de redactarla:

1. Identificar los paths/módulos que la Story va a tocar (basado en el plan inicial).
2. Clasificar riesgo del ticket:
   ```
   sdd_classify_risk({paths: [...], description: <título + descripción breve>})
   ```
3. Persistir:
   ```
   sdd_register_risk({scope: "ticket", ticketId: <ID_que_se_creará>, level, reasons})
   ```
   > Nota: si el ticket todavía no fue creado en el tracker, podés diferir
   > este `sdd_register_risk` a justo después de `createJiraIssue`, cuando
   > ya tenés el ID real.

4. Filtrar `changeDecisions` por las que aplican a esta Story:
   - Si `decision.affectsTickets` incluye el ID o el slug de esta Story → incluir.
   - Si `affectsTickets` está vacío (decisión global) → incluir.

## Step 4: Redactar en __SDD_IDIOMA_TICKETS__

> **V4.18 — Definition of Ready**: cada Story debe tener las 8 secciones de
> abajo. El MCP server valida con `sdd_validate_ticket_dor` antes de planificar:
> en modo `strict` bloquea PLAN si falta alguna, en `warn` advierte. Las
> Sub-tasks tienen template más liviano (heredan contexto del Story padre).

### Template Story:
```
**Como** [tipo de usuario]
**Quiero** [acción]
**Para** [beneficio]

## Objetivo
[1-2 frases en lenguaje de producto — qué problema resuelve para el usuario
o sistema. Incluir métrica de impacto si está disponible (ej. "bajar drop-off
del 40% al 25%"). NO técnico.]

## Contexto técnico
- Módulos/archivos involucrados: [lista REAL del codebase, no inventada]
- Patrones a seguir: [referencias a código existente similar, por path]
- Servicios externos: [SDKs, APIs externas, o "ninguno"]

## Criterios de aceptación
- [ ] Dado que [precondición], cuando [acción], entonces [resultado observable/medible]
- [ ] Dado que [...], cuando [...], entonces [...]
(mínimo 2. PROHIBIDAS palabras vagas sin métrica: "correctamente",
 "apropiadamente", "intuitivo", "user-friendly". Usar condiciones
 observables: status codes, shapes de response, tiempos con métrica, etc.)

## Fuera de scope
- [ítem 1 explícito que NO se hace en este ticket]
- [ítem 2]
(mínimo 1 ítem. PROHIBIDO "nada"/"ninguno"/"N/A" — si nada queda fuera,
 el ticket es demasiado grande y debe partirse.)

## Dependencias
- Tickets bloqueantes: [IDs o "ninguno"]
- Decisiones pendientes: ["ninguna" o lista de preguntas abiertas]
- Servicios externos: [credentials, SDKs, accesos requeridos]

## Riesgos
- [perf, seguridad, datos sensibles, backwards-compat, migrations, race conditions]
- O explícito "ningún riesgo identificado" (raro — el clasificador lo marca para review)

## Test cases declarados
- Golden path: [descripción del happy path + qué se espera]
- Edge case 1: [qué entrada inusual + qué se espera]
- Edge case 2: [otra entrada inusual + qué se espera]
(mínimo 3. Estos son contratos directos para /auto-verify futuro.)

## Definition of Done
- [ ] Código mergeado a la rama de desarrollo
- [ ] Tests declarados pasan
- [ ] [requisito específico del ticket: doc actualizada, feature flag agregada,
       migration corrida en staging, credentials configuradas, etc.]

## Decisiones del PO (V4.19 — gap analysis)
{Si hay changeDecisions relevantes a este ticket, incluir como Q/A:}
- **¿{question}?** → {answer}
- ...
{Si no hay decisiones relevantes: omitir esta sección.}

## Riesgo
{Insertar level + razones de sdd_classify_risk para este ticket:}
**Nivel**: {low | medium | high}
{Si level=high, agregar:}
> ⚠️ Ticket clasificado como HIGH risk. Razones: {reasons separadas por coma}.
> Requiere review obligatoria + tests cubriendo paths sensibles.
```

### Template Sub-task:
```
**Objetivo**: [qué hacer técnicamente]
**Pertenece a**: [Story ID padre]
**Archivo**: `[ruta real]` — [create/modify] — [descripción]
**Criterio**: [cómo saber que está listo — observable]
```

> **Sub-tasks no requieren DoR completo**: heredan Objetivo/Contexto/AC del Story padre.
> El validador solo aplica a Stories (issuetype = Story | Task | Feature).

## Step 5: Mostrar resumen — esperar confirmación explícita

## Step 6: Crear tickets
Orden: Epic → Stories → Sub-tasks.
Confirmar creación de cada uno.

Al crear cada ticket con `createJiraIssue`, pasar:
- `assignee_account_id`: el account ID resuelto en Step 1b (si el usuario eligió asignar)
- `additional_fields`: `{ "sprint": { "id": {sprint_id} } }` — el sprint activo detectado en Step 1b

## Step 7: Resumen final
Tabla: ID | Tipo | Título | Assignee | Sprint | URL

# Reglas
- Idioma: __SDD_IDIOMA_TICKETS__
- Confirmar antes de crear — NUNCA crear sin confirmación
- Usar rutas y componentes reales del proyecto
- **Todos los tickets deben ir al sprint activo** — sin excepciones
- Si MCP falla mid-process: mostrar lo creado + lo pendiente en formato texto
