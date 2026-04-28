# `.ai-internal/.upgrade-pending` — Schema y contrato

Documentación canónica del archivo que coordina los upgrades entre el instalador
(`install-bootstrap.sh`) y el orquestador (`bootstrap.md`). Cualquier cambio al
formato debe actualizarse acá primero, luego en los dos consumidores.

## Propósito

`.ai-internal/.upgrade-pending` es una **bandera transitoria** escrita por el
instalador cuando detecta que la versión instalada del proyecto difiere de la
versión que se está descargando. La bandera la consume `/bootstrap` para
ejecutar el flujo de upgrade (regenerar archivos adaptados, migrar pipeline, etc.)
y se borra al final del flujo.

## Ciclo de vida

```
┌─────────────────────────┐
│ install-bootstrap.sh    │  Detecta version_changed | content_changed | pre_meta_legacy
│ (líneas ~370-400)       │  Escribe .ai-internal/.upgrade-pending
└─────────────┬───────────┘
              │
              ▼
┌─────────────────────────┐
│ /bootstrap (bootstrap.md)│ Lee el archivo, parsea, ejecuta Modo Upgrade
│ Tier 1 detection         │ (Fases 1+2+gaps+metadata en una sola invocación)
└─────────────┬───────────┘
              │
              ▼
┌─────────────────────────┐
│ /bootstrap (final)       │  rm -f .ai-internal/.upgrade-pending
│ líneas 62, 219, 489      │  La bandera se elimina al completar el upgrade.
└─────────────────────────┘
```

## Schema JSON

```json
{
  "from_version": "string",
  "to_version": "string",
  "from_hash": "string",
  "to_hash": "string",
  "trigger": "version_changed | content_changed | pre_meta_legacy",
  "timestamp": "string (ISO 8601 UTC, e.g. 2026-04-28T14:30:00Z)",
  "files_updated": ["string", ...]
}
```

### Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `from_version` | string | sí | Versión instalada antes del upgrade. Ej: `"4.8"`. `"unknown"` si no había `.bootstrap-meta.json`. |
| `to_version` | string | sí | Versión que se está instalando. Ej: `"4.9"`. |
| `from_hash` | string | sí | SHA-256 del contenido instalado anteriormente (calculado sobre los archivos descargados en la versión previa). `"none"` si no aplica. |
| `to_hash` | string | sí | SHA-256 del contenido nuevo que se está instalando. `"none"` si el cálculo falla. |
| `trigger` | enum string | sí | Razón del upgrade. Tres valores válidos. Ver tabla abajo. |
| `timestamp` | string ISO 8601 | sí | Cuándo se detectó el upgrade. UTC. |
| `files_updated` | string[] | sí | Lista de paths de destino que el instalador actualizó (relativos al project root). Ej: `[".ai-internal/phases/phase-0-detect.md", ...]`. |

### Triggers

| Trigger | Cuándo se usa | Acción de `/bootstrap` |
|---------|---------------|------------------------|
| `version_changed` | `from_version` ≠ `to_version` (la versión declarada cambió) | Ejecutar Modo Upgrade completo: regenerar adaptados, aplicar gaps, actualizar metadata. |
| `content_changed` | Misma versión declarada, pero `from_hash` ≠ `to_hash` (los archivos fuente cambiaron sin bump de versión — típicamente parches dentro de la misma minor) | Igual que `version_changed`. Nota: idealmente todo cambio de contenido debería bumpear versión; este trigger existe para resiliencia. |
| `pre_meta_legacy` | El proyecto no tiene `.bootstrap-meta.json` (instalación previa a V4.4 cuando se introdujo el archivo) | Modo Upgrade tratando el proyecto como legacy: migrar `pipeline-tracker.md` → `pipeline-state.json`, regenerar todo. |

## Contratos

### Quién escribe

**`install-bootstrap.sh`** (líneas ~370-400) escribe el archivo
inmediatamente después de descargar todos los archivos remotos y antes de salir.
Responsabilidades:

- Calcular `from_hash` y `to_hash` (SHA-256 sobre la concatenación ordenada de
  archivos `.ai-internal/`).
- Determinar `trigger` según los checks en orden:
  1. Si `.bootstrap-meta.json` no existía → `pre_meta_legacy`
  2. Si `from_version ≠ to_version` → `version_changed`
  3. Si `from_hash ≠ to_hash` → `content_changed`
  4. Si nada cambió → **NO escribir el archivo**

- Escribir el archivo de forma atómica (escribir a `.tmp`, luego rename) si en
  el futuro se quiere endurecer.

### Quién lee

**`bootstrap.md`** (Tier 1 detection, líneas ~18-62):

- Si el archivo existe → entrar en Modo Upgrade.
- Parsear los campos. Si `from_version === to_version` y `trigger ≠ pre_meta_legacy`,
  igual ejecutar (significa `content_changed`).

### Quién borra

**`bootstrap.md`** al completar el flujo de upgrade (líneas 62, 219, 489).

`install-bootstrap.sh` **NUNCA** borra el archivo (eso indica que el upgrade
quedó incompleto y el siguiente `/bootstrap` debe retomarlo).

## Invariantes

1. Si `.upgrade-pending` existe, `/bootstrap` no debe ejecutar el modo Normal.
   Siempre Modo Upgrade.
2. `to_version` siempre debe coincidir con la versión hardcodeada en
   `install-bootstrap.sh` (variable `BOOTSTRAP_VERSION`). Si no coincide, el
   archivo está corrupto — abortar y pedir reinstalar.
3. `files_updated` no debe contener paths con `..` o paths absolutos (sandbox
   ya validado en el instalador a partir de V4.9).
4. El archivo es **transitorio**. Su presencia indica trabajo pendiente. No
   debe sobrevivir a un `/bootstrap` exitoso.

## Ejemplo

```json
{
  "from_version": "4.8",
  "to_version": "4.9",
  "from_hash": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "to_hash": "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "trigger": "version_changed",
  "timestamp": "2026-04-28T14:30:00Z",
  "files_updated": [
    ".ai-internal/phases/phase-0-detect.md",
    ".ai-internal/phases/phase-1-reusables.md",
    ".ai-internal/phases/phase-2-adapted.md",
    ".ai-internal/phases/phase-3-finalize.md",
    ".ai-internal/templates/menu-template.md",
    ".ai-internal/mcp-server/src/pipeline.ts",
    ".ai-internal/hooks/post-compact-reminder.sh"
  ]
}
```
