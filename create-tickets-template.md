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

## Step 4: Redactar en __SDD_IDIOMA_TICKETS__

### Template Story:
```
**Como** [tipo de usuario]
**Quiero** [acción]
**Para** [beneficio]

**Criterios de aceptación:**
- Dado que [contexto], cuando [acción], entonces [resultado]

**Detalle técnico:**
- Componentes/servicios: [lista]
- Endpoints: [lista]
- Archivos: [lista]
- Validaciones: [lista]

**Definition of Done:**
- [ ] Código en PR
- [ ] Tests pasando
- [ ] Code review aprobado
```

### Template Sub-task:
```
**Objetivo**: [qué hacer]
**Archivo**: `[ruta]` — [create/modify] — [descripción]
**Criterio**: [cómo saber que está listo]
```

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
