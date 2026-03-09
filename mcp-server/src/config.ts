import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectConfig } from "./types.js";

const PROFILE_PATH = join(
  process.cwd(),
  ".ai-internal",
  "project-profile.md",
);

export async function loadProjectConfig(): Promise<ProjectConfig | null> {
  try {
    const content = await readFile(PROFILE_PATH, "utf-8");
    return parseProfile(content);
  } catch {
    return null;
  }
}

function parseProfile(content: string): ProjectConfig {
  const get = (key: string): string => {
    // Match patterns like "- **Key**: value" or "Key: value"
    const patterns = [
      new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, "i"),
      new RegExp(`^-?\\s*${key}:\\s*(.+)`, "im"),
      new RegExp(`${key}\\s*[:=]\\s*(.+)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1].trim();
    }
    return "";
  };

  return {
    nombre: get("Nombre|nombre|Project Name|project_name"),
    tipo: get("Tipo|tipo|Type|type|Project Type"),
    tracker: get("Tracker|tracker"),
    cloudId: get("CloudId|cloudId|cloud_id|Tracker CloudId"),
    projectKey: get("Tracker Project Key|project_key|Project Key"),
    idioma: get("Idioma|idioma|Language|language"),
  };
}

export interface ConfigValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateConfig(): Promise<ConfigValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const config = await loadProjectConfig();

  if (!config) {
    errors.push(
      "No se encontró .ai-internal/project-profile.md — ejecutá /bootstrap para configurar el entorno.",
    );
    return { ok: false, errors, warnings };
  }

  if (!config.nombre) {
    warnings.push(
      "Nombre del proyecto no detectado en el perfil.",
    );
  }

  if (!config.tipo) {
    warnings.push(
      "Tipo de proyecto no detectado en el perfil.",
    );
  }

  if (!config.tracker) {
    errors.push(
      "Tracker no configurado en el perfil. Sin tracker no se pueden crear/gestionar tickets.",
    );
  }

  if (!config.cloudId || config.cloudId.toLowerCase().includes("pendiente") || config.cloudId.toLowerCase().includes("todo") || config.cloudId === "N/A") {
    errors.push(
      "CloudId del tracker no configurado. Sin cloudId no se puede interactuar con el tracker. Configuralo en .ai-internal/project-profile.md.",
    );
  }

  if (!config.projectKey) {
    warnings.push(
      "Project Key del tracker no configurado en el perfil. Algunos comandos pueden no funcionar correctamente.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
