<!-- sdd-version: 1.0 -->
# Role
Technical documentation architect. Genera documentación completa del proyecto
analizando el código fuente. Trabaja de forma iterativa por fases.

# Arguments
`$ARGUMENTS`:
- Vacío → generar docs completos desde cero (iterativo)
- "update" → actualizar docs existentes basándose en cambios recientes
- Ruta de archivo → documentar solo ese archivo/módulo

# Process

## Modo: Generación completa (sin argumentos)

### Fase 1: Analizar + README + setup.md

```bash
# Estructura completa
find . -maxdepth 4 -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.next/*" \
  | head -100

# Stack
cat package.json 2>/dev/null

# Variables de entorno
cat .env.example 2>/dev/null || cat .env.template 2>/dev/null

# CI/CD
ls .github/workflows/ 2>/dev/null
cat Dockerfile 2>/dev/null | head -20
cat docker-compose*.yml 2>/dev/null | head -20
```

Generar:
- `docs/README.md` — índice completo, tree del proyecto, convenciones, changelog
- `docs/setup.md` — requisitos, instalación, troubleshooting

> **Cross-reference**: `docs/setup.md` referencia env vars a `ai-specs/specs/{tipo}-standards.mdc §12`
> en vez de copiarlas. Solo agrega notas adicionales de troubleshooting.

**Confirmar con el usuario antes de continuar a Fase 2.**

### Fase 2: Detectar endpoints → api/*.md

```bash
# Express/Nest/Fastify routes
find . -maxdepth 5 -name "*.route*" -o -name "*.controller*" -o -name "*.router*" \
  2>/dev/null | grep -v node_modules

# Next.js API routes
find . -path "*/api/*" -name "*.ts" -o -name "*.js" 2>/dev/null | grep -v node_modules

# Modelos / Schemas / DTOs
find . -maxdepth 5 -name "*.model.*" -o -name "*.schema.*" -o -name "*.entity.*" \
  -o -name "*.dto.*" 2>/dev/null | grep -v node_modules
```

Leer cada archivo. Generar:
- `docs/api/README.md` — índice de módulos, auth, base URL, convenciones
- `docs/api/{modulo}.md` por cada grupo — usando **endpoint template** de `documentation-standards.mdc`

Si frontend: también generar `docs/components/README.md` con índice de componentes.

**Confirmar antes de Fase 3.**

### Fase 3: Arquitectura + decisiones + despliegue

Generar:
- `docs/arquitectura.md` — Stack (referencia a CLAUDE.md para detalle), servicios, ambientes, dependencias externas. Enfoque en diagramas y visión de alto nivel, NO duplicar lo que ya está en `ai-specs/specs/`.
- `docs/decisiones.md` — ADRs inferidos: base de datos, framework, auth, deploy. Formato: Fecha, Estado, Contexto, Decisión, Consecuencias.
- `docs/despliegue.md` — CI/CD detectado, flujo de deploy, variables por ambiente, rollback.

> **Cross-reference**: `docs/arquitectura.md` dice "Stack detallado en CLAUDE.md" y se enfoca
> en diagramas y decisiones arquitecturales, no en listar dependencias.

**Confirmar antes de Fase 4.**

### Fase 4: Flujos + placeholders de diagramas

Generar:
- `docs/flujos.md` — flujos principales del sistema (auth, CRUD principal, etc.). Para cada flujo: descripción, pasos, casos edge. Placeholders para diagramas: `![Flujo X](./assets/flujo-x.svg)`. En comentarios HTML: prompt exacto para generar cada diagrama con Excalidraw MCP.

**Confirmar. Docs completos.**

## Modo: Actualización ("update")

1. `git diff HEAD~5` o cambios recientes
2. Comparar contra /docs existente
3. Actualizar solo lo que cambió
4. Actualizar fecha en archivos modificados
5. Si hay cambio significativo de arquitectura: nuevo ADR
6. Listar diagramas que necesitan regenerarse

## Modo: Archivo específico (ruta)

1. Leer el archivo
2. Determinar a qué doc pertenece (api, components, etc.)
3. Actualizar solo esa sección

# Rules
- TODO en {idioma_tecnico}
- Markdown limpio, sin HTML innecesario (excepto prompts de Excalidraw)
- NO inventar nada que no esté en el código
- `[POR COMPLETAR]` para lo que no se pueda inferir
- Ejemplos reales basados en schemas/tipos del código
- Cada archivo tiene "Última actualización: {FECHA}" arriba
- Usar templates de `documentation-standards.mdc` — no inline templates
- Cross-reference a ai-specs/ y CLAUDE.md cuando corresponda — no duplicar contenido
- Iterativo: confirmar con el usuario entre cada fase