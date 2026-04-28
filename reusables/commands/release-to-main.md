<!-- sdd-version: 1.0 -->
# Role
Release manager. Lee tickets aprobados por QA y crea un PR de dev a main.

# Arguments
`$ARGUMENTS`:
- Vacío → buscar tickets aprobados automáticamente
- "check" / "status" → solo mostrar tickets aprobados sin crear PR

# Process

## 1. Resolver rama de desarrollo

Leer `Dev Branch` de `.ai-internal/project-profile.md`.
Si no existe, auto-detectar:
```bash
git branch -r --list 'origin/dev' 'origin/develop' 'origin/development' | sed 's|origin/||' | head -1 | xargs
```
Si no se encuentra → preguntar al usuario. Guardar como `DEV_BRANCH`.

## 2. Buscar tickets aprobados por QA

Leer de `.ai-internal/project-profile.md`:
- `Tracker` → tipo de tracker (jira, notion)
- `Tracker Project Key` → `PROJECT_KEY`
- `Tracker CloudId` → `CLOUD_ID` (solo Jira)
- Statuses → obtener el nombre real del status "QA Approved" y "QA Failed" en este proyecto

**Si tracker=jira**:

Leer `Jira Statuses` del profile.

Buscar tickets aprobados via Jira MCP:

Llamar `searchJiraIssuesUsingJql` con:
- cloudId: `CLOUD_ID`
- JQL: `project = {PROJECT_KEY} AND status = "{nombre_real_qa_approved}" ORDER BY updated DESC`

Si `Jira Statuses` no tiene mapping (profile viejo), usar fallback con múltiples nombres:
- JQL: `project = {PROJECT_KEY} AND status in ("QA Approved", "QA Aprobado", "Approved", "Aprobado", "Ready for Release") ORDER BY updated DESC`

También buscar tickets rechazados para mostrar advertencia:
- JQL: `project = {PROJECT_KEY} AND status = "{nombre_real_qa_failed}" ORDER BY updated DESC`

**Si tracker=notion**:

Leer `Notion Statuses` y `Notion Status Property` del profile.

Consultar la database de Notion filtrando por la propiedad de status = nombre real de "QA Approved" (de `Notion Statuses` en el profile).
Usar `API-query-data-source` con `data_source_id: "{notion_database_id}"` y filter: `{ "property": "{status_property}", "status": { "equals": "{nombre_real_qa_approved}" } }`

Para tickets rechazados:
Filtrar por status = nombre real de "QA Failed".

## 3. Mostrar resumen

```
📋 Tickets aprobados por QA:

  ✅ {TICKET-1}: {título}
  ✅ {TICKET-2}: {título}
  ...

  Total: {N} tickets listos para release

  Release: {DEV_BRANCH} → main
```

Si hay tickets con estado "QA Failed" / "QA Rechazado" en el mismo proyecto, mostrar advertencia:
```
⚠️  Tickets rechazados por QA (NO incluidos):
  ❌ {TICKET-X}: {título} — estado: QA Failed
```

Si no hay tickets aprobados:
```
ℹ️  No hay tickets aprobados por QA en este momento.
    Los tickets deben estar en estado "QA Approved" para incluirlos en el release.
```
HALT.

Si `$ARGUMENTS` es "check" / "status": mostrar resumen y HALT (no crear PR).

## 4. Confirmar release

Usar **AskUserQuestion** (single_select):
"¿Crear PR de {DEV_BRANCH} → main con estos {N} tickets?"

Opciones:
- "Crear PR de release"
- "Cancelar"

Si cancela → HALT.

## 5. Crear PR de release

```bash
gh --version 2>/dev/null || echo "GH_NOT_FOUND"
```

Si `gh` no disponible: mostrar instrucciones manuales y HALT.

Verificar que `DEV_BRANCH` esté actualizado:
```bash
git fetch origin
git log --oneline origin/{DEV_BRANCH}...origin/main | head -20
```

Si no hay commits nuevos en dev vs main:
```
ℹ️  No hay cambios en {DEV_BRANCH} que no estén en main.
```
HALT.

Antes de crear el PR, buscar evidencia de cada ticket:
```bash
for TICKET in {lista_de_tickets_aprobados}; do
  test -f "docs/evidence/${TICKET}.md" && echo "${TICKET}=HAS_EVIDENCE" || echo "${TICKET}=NO_EVIDENCE"
done
```

Obtener la URL del repo para los links:
```bash
gh repo view --json url -q .url 2>/dev/null || git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|'
```

Crear el PR:
- **Title**: `Release: {N} tickets aprobados por QA`
- **Base**: `main`
- **Head**: `{DEV_BRANCH}`
- **Body**:
  ```
  ## Tickets incluidos

  {por cada ticket aprobado:}
  - [{TICKET-ID}]({ticket_url}) — {título} | [Evidencia]({GH_REPO_URL}/blob/{DEV_BRANCH}/docs/evidence/{TICKET-ID}.md)
  > **Si tracker=jira**: `{ticket_url}` = URL de Jira issue
  > **Si tracker=notion**: `{ticket_url}` = URL de Notion page (`https://notion.so/{page_id}`)
  {si el ticket NO tiene evidencia: marcar con ⚠️ en vez de link}

  ## QA
  Todos los tickets fueron probados y aprobados en el ambiente de desarrollo.

  {si hay tickets sin evidencia:}
  ### Tickets sin evidencia
  ⚠️ Los siguientes tickets no tienen evidencia documentada:
  - {TICKET-X} — {título}

  {si hay tickets rechazados:}
  ## Excluidos (QA Failed)
  - {TICKET-X} — {título} (pendiente de fix)
  ```

## 6. Mostrar resultado

```
✅ PR de release creado: {PR_URL}

   {DEV_BRANCH} → main
   {N} tickets incluidos
   📝 Evidencia: {X}/{N} tickets con evidencia documentada
   {si hay sin evidencia: "⚠️ {Y} tickets sin evidencia"}

   Cuando se apruebe y mergee el PR, los cambios pasan a producción.
```

# Guardrails
- NUNCA hacer merge directo — siempre crear PR para review
- NUNCA incluir tickets que no estén aprobados por QA
- Si hay conflictos entre dev y main, reportarlos — no intentar resolverlos automáticamente