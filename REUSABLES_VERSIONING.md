# Versionado por archivo en `reusables/`

Cada archivo de `reusables/` lleva un marcador de versión propio. Esto habilita
upgrades granulares: el flujo de `/bootstrap` puede comparar la versión del
archivo descargado contra la versión instalada en el proyecto del usuario y
**solo regenerar los archivos que efectivamente cambiaron** — preservando
ediciones manuales en los demás.

Introducido en V4.9.

## Formato del marcador

Hay dos variantes según si el archivo tiene frontmatter YAML o no:

### Archivos con frontmatter (OPSX commands, agents)

El marcador va como una clave más en el frontmatter:

```yaml
---
name: "OPSX: Apply"
description: Implement tasks from an OpenSpec change
category: Workflow
tags: [workflow, artifacts, experimental]
sdd_version: "1.0"
---
```

### Archivos sin frontmatter (commands en `reusables/commands/`)

El marcador va como comentario HTML en la primera línea:

```markdown
<!-- sdd-version: 1.0 -->
# Role
Senior engineer. ...
```

> El comentario HTML se renderiza como invisible en cualquier visor markdown
> (GitHub, VS Code, etc.) y no interfiere con el parser de Claude Code para
> slash commands.

## Cómo extraer la versión de un archivo

```bash
# Para frontmatter
grep -E '^sdd_version:' archivo.md | sed -E 's/.*"([^"]+)".*/\1/'

# Para comentario HTML
grep -oE 'sdd-version: [0-9.]+' archivo.md | awk '{print $2}'

# Universal (cubre ambos formatos)
grep -oE '(sdd_version|sdd-version)[: ]+["]?[0-9.]+' archivo.md | grep -oE '[0-9.]+' | head -1
```

## Cómo se usa en el flujo de upgrade

**Situación actual (V4.9)**: el marcador está presente en todos los reusables
pero el flujo de `/bootstrap` aún regenera todos los reusables en cada upgrade
(estrategia simple, sobrescribe).

**Roadmap (V5.0+)**: `phase-1-reusables.md` comparará la versión del archivo
en `.ai-internal/reusables/{x}.md` vs el archivo ya instalado en el destino
final (`.claude/commands/opsx/{x}.md`, etc.). Solo regenera si las versiones
son distintas. Si son iguales, preserva el archivo destino tal cual (puede
estar editado manualmente por el usuario).

```bash
# Pseudo-código del upgrade granular (futuro)
NEW_VERSION=$(extract_version "$SOURCE")
INSTALLED_VERSION=$(extract_version "$DEST")

if [ "$NEW_VERSION" != "$INSTALLED_VERSION" ]; then
  cp "$SOURCE" "$DEST"
  echo "✅ Upgraded $DEST (${INSTALLED_VERSION:-none} → $NEW_VERSION)"
else
  echo "⏭️  Skipped $DEST (already at $NEW_VERSION)"
fi
```

## Convenciones de bump de versión

| Tipo de cambio | Bump | Ejemplo |
|----------------|------|---------|
| Fix de typo, reformat | No bump | 1.0 → 1.0 |
| Mejora de prompt sin cambio funcional | Patch | 1.0 → 1.0.1 |
| Cambio funcional pequeño | Minor | 1.0 → 1.1 |
| Cambio que rompe el contrato esperado por el usuario | Major | 1.0 → 2.0 |

Versiones siguen [semver](https://semver.org). El `sdd_version` es independiente
del `bootstrap_version` global del proyecto.

## Para mantenedores

Cuando edites un reusable:

1. Hacer el cambio.
2. Bumpear `sdd_version` según la tabla de arriba.
3. Correr `./generate-manifest.sh` para regenerar el SHA-256 en
   `bootstrap-manifest.json`.
4. Commitear ambos archivos juntos.

Si `sdd_version` no se bumpea, el upgrade granular (cuando esté implementado)
no detectará el cambio y los usuarios seguirán con la versión vieja.
