<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNC BUDDY: create-tickets-template.md
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
# El MCP de __SDD_TRACKER__ (Notion) debe estar disponible
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
Obtener la base de datos de Notion con ID `__SDD_NOTION_DATABASE_ID__`.
Llamar `API-retrieve-a-data-source` con `data_source_id: "__SDD_NOTION_DATABASE_ID__"` para validar acceso y obtener el schema de propiedades.
Del schema, identificar las propiedades disponibles (título, status, tipo, assignee, etc.) para mapear correctamente al crear páginas.

## Step 1b: Detectar assignee

1. **Obtener usuario actual** — Llamar `API-get-self` (sin argumentos) para obtener el usuario autenticado.
   Guardar `id` y `name` del usuario.

2. **Preguntar assignee** — AskUserQuestion (single_select):
   ```
   ¿A quién se asignan los tickets?

   1. A mí ({nombre del usuario actual})
   2. Sin asignar (asignar después en Notion)
   3. A otra persona (buscar por nombre)
   ```
   - Si elige "otra persona" → preguntar nombre → `API-post-search` con query=nombre y filter={value:"person",property:"object"} → confirmar match

## Step 2: Leer fuente
- Path → leer archivo
- Change OpenSpec → leer `openspec/changes/<name>/` artifacts
- Texto libre → usar directamente

## Step 3: Diseñar estructura
- **Epic** (opcional): para features con múltiples stories — se crea como página con propiedad tipo "Epic"
- **Stories**: una por funcionalidad / flujo de usuario
- **Sub-tasks**: tareas técnicas específicas — se crean como páginas con relación a su Story parent (si la DB tiene propiedad de relación/sub-items)

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

## Step 6: Crear páginas en Notion
Orden: Epic → Stories → Sub-tasks.
Confirmar creación de cada uno.

Al crear cada ticket con `API-post-page`, pasar:
- `parent`: `{ "database_id": "__SDD_NOTION_DATABASE_ID__" }`
- `properties`: mapear según el schema detectado en Step 1. Ejemplo típico:
  ```json
  {
    "Name": { "title": [{ "text": { "content": "Título del ticket" } }] },
    "Type": { "select": { "name": "Story" } },
    "Status": { "status": { "name": "Not started" } },
    "Assignee": { "people": [{ "id": "user_id" }] }
  }
  ```
  Adaptar nombres de propiedades al schema real de la DB (detectado en Step 1).
- `children`: contenido del ticket como bloques Notion:
  ```json
  [
    { "object": "block", "type": "heading_2", "heading_2": { "rich_text": [{ "text": { "content": "User Story" } }] } },
    { "object": "block", "type": "paragraph", "paragraph": { "rich_text": [{ "text": { "content": "Como [usuario]..." } }] } },
    { "object": "block", "type": "heading_2", "heading_2": { "rich_text": [{ "text": { "content": "Criterios de aceptación" } }] } },
    { "object": "block", "type": "bulleted_list_item", "bulleted_list_item": { "rich_text": [{ "text": { "content": "Dado que..." } }] } },
    { "object": "block", "type": "heading_2", "heading_2": { "rich_text": [{ "text": { "content": "Detalle técnico" } }] } },
    { "object": "block", "type": "bulleted_list_item", "bulleted_list_item": { "rich_text": [{ "text": { "content": "Componentes: ..." } }] } },
    { "object": "block", "type": "heading_2", "heading_2": { "rich_text": [{ "text": { "content": "Definition of Done" } }] } },
    { "object": "block", "type": "to_do", "to_do": { "rich_text": [{ "text": { "content": "Código en PR" } }], "checked": false } }
  ]
  ```

Si la DB tiene propiedad de relación para sub-items/parent: vincular Sub-tasks a su Story parent.

## Step 7: Resumen final
Tabla: Título | Tipo | Assignee | Status | URL

Donde URL = `https://notion.so/{page_id_sin_guiones}`

# Reglas
- Idioma: __SDD_IDIOMA_TICKETS__
- Confirmar antes de crear — NUNCA crear sin confirmación
- Usar rutas y componentes reales del proyecto
- Si MCP falla mid-process: mostrar lo creado + lo pendiente en formato texto
- Adaptar propiedades al schema real de la DB — no asumir nombres fijos
