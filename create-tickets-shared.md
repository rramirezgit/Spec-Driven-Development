# `create-tickets-*.md` — Contrato de sincronización

Este archivo documenta las **secciones que deben mantenerse alineadas** entre los
dos templates de creación de tickets:

- `create-tickets-template.md` (tracker = Jira)
- `create-tickets-template-notion.md` (tracker = Notion)

Si se modifica una sección compartida en uno de los templates, **debe actualizarse
en el otro** y reflejarse acá.

---

## Secciones compartidas (deben quedar idénticas)

| Sección | Contenido | Notas |
|---------|-----------|-------|
| `# Role` | "Product Owner experto. Tickets claros y completos en `__SDD_IDIOMA_TICKETS__`, listos para implementar." | Idéntico. |
| `# Arguments` | `$ARGUMENTS` — Path a artefacto, nombre de OpenSpec change, o descripción. | Idéntico. |
| `## Step 0: Preflight — verificar MCP disponible` | Check de disponibilidad del MCP del tracker, fallback a generación de texto si no está disponible. | Idéntico salvo el nombre del tracker (`__SDD_TRACKER__`). |
| `## Step 2: Leer fuente` | Path → archivo. Change OpenSpec → leer `openspec/changes/<name>/`. Texto libre → usar directamente. | Idéntico. |
| `## Step 3: Diseñar estructura` | Epic (opcional), Stories (por funcionalidad), Sub-tasks (técnicas). | Idéntico. Notion agrega nota sobre relación parent/sub-item si la DB lo permite. |
| `## Step 4: Redactar en __SDD_IDIOMA_TICKETS__` | Template Story V4.18 (8 secciones DoR: Como/Quiero/Para, Objetivo, Contexto técnico, Criterios de aceptación GWT, Fuera de scope, Dependencias, Riesgos, Test cases, Definition of Done) + Template Sub-task simplificado. | **Idéntico byte-por-byte.** V4.18+ obligatorio para validador `sdd_validate_ticket_dor`. |
| `## Step 5: Mostrar resumen — esperar confirmación explícita` | Una línea. | Idéntico. |
| `## Step 7: Resumen final` | Tabla con columnas, formato URL específico por tracker. | Estructura idéntica, columnas se adaptan. |
| `# Reglas` | Idioma, confirmar antes de crear, usar rutas reales, manejo de fallas MCP. | Casi idéntico — Jira agrega regla de "todos los tickets deben ir al sprint activo"; Notion agrega "adaptar propiedades al schema real de la DB". |

## Secciones específicas (no sincronizar)

| Sección | Jira | Notion |
|---------|------|--------|
| `## Step 1: Contexto del proyecto` | Lista proyectos por `cloudId`, pregunta si hay múltiples. | Recupera schema de database por `__SDD_NOTION_DATABASE_ID__` con `API-retrieve-a-data-source`. |
| `## Step 1b` | Detecta sprint activo (JQL) **+** assignee. **BLOQUEA** si no hay sprint activo. | Solo assignee (Notion no tiene sprints). |
| `## Step 6: Crear ...` | `createJiraIssue` con `assignee_account_id` + `additional_fields.sprint`. | `API-post-page` con `parent.database_id`, properties mapeadas al schema, children como bloques Notion. |

## Reglas de mantenimiento

1. **Cambio en sección compartida** → editar AMBOS templates en el mismo PR/commit. CI debería diff-checkar las secciones marcadas como idénticas.
2. **Cambio que solo aplica a un tracker** → editar solo el template específico y, si rompe el contrato, actualizar este archivo.
3. **Nuevo tracker en el futuro** (ej. Linear) → crear `create-tickets-template-linear.md` heredando este contrato.

## Por qué no hay sistema de includes

`phase-2-adapted.md` aplica `sed` para sustituir placeholders `__SDD_*__` y copia el archivo completo al destino. No hay resolución de includes ni concatenación de fragments. Mover a un sistema de includes requeriría reescribir Phase 2 — pendiente para una versión futura. Mientras tanto, este archivo es el contrato manual de sincronización.
