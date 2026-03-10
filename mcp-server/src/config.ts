import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectConfig } from "./types.js";

// Resolve project root from the compiled JS location:
// dist/config.js → dist/ → mcp-server/ → .ai-internal/ → PROJECT_ROOT
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

const PROFILE_PATH = join(
  PROJECT_ROOT,
  ".ai-internal",
  "project-profile.md",
);

export async function loadProjectConfig(): Promise<ProjectConfig | null> {
  try {
    const content = await readFile(PROFILE_PATH, "utf-8");
    return parseProfile(content);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // File doesn't exist — expected before bootstrap runs
      return null;
    }
    // File exists but is unreadable or corrupted — warn explicitly
    console.error(
      `ERROR: Failed to load project config from ${PROFILE_PATH}: ${(err as Error).message}. Returning null.`,
    );
    return null;
  }
}

/**
 * Escapes special regex characters in a string so it can be used
 * as a literal match inside a RegExp constructor.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseProfile(content: string): ProjectConfig {
  /**
   * Searches for a key-value pair in the profile content.
   * Tries each key independently against multiple markdown patterns.
   * Keys are regex-escaped to prevent injection.
   */
  const get = (...keys: string[]): string => {
    for (const key of keys) {
      const escaped = escapeRegex(key);
      const patterns = [
        // "- **Key**: value" (bold markdown list item)
        new RegExp(`\\*\\*${escaped}\\*\\*:\\s*(.+)`, "i"),
        // "- Key: value" (plain list item)
        new RegExp(`^-?\\s*${escaped}:\\s*(.+)`, "im"),
        // "Key: value" or "Key = value" (plain)
        new RegExp(`${escaped}\\s*[:=]\\s*(.+)`, "i"),
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match?.[1]) return match[1].trim();
      }
    }
    return "";
  };

  // Extract QA Review status name from Jira Statuses JSON (if present)
  const jiraStatusesRaw = get("Jira Statuses", "jira_statuses");
  let jiraQaStatus = "";
  if (jiraStatusesRaw) {
    try {
      const statuses = JSON.parse(jiraStatusesRaw);
      jiraQaStatus = statuses.qa_review || "";
    } catch {
      // Not valid JSON — ignore
    }
  }

  return {
    nombre: get("Nombre", "nombre", "Project Name", "project_name"),
    tipo: get("Tipo", "tipo", "Type", "type", "Project Type"),
    tracker: get("Tracker", "tracker"),
    cloudId: get("CloudId", "cloudId", "cloud_id", "Tracker CloudId"),
    projectKey: get("Tracker Project Key", "project_key", "Project Key"),
    idioma: get("Idioma", "idioma", "Language", "language"),
    jiraQaStatus,
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
      "Tipo de proyecto no detectado en el perfil. Algunos comandos adaptados pueden no generarse correctamente.",
    );
  }

  if (!config.tracker) {
    errors.push(
      "Tracker no configurado en el perfil. Sin tracker no se pueden crear/gestionar tickets.",
    );
  }

  if (
    !config.cloudId ||
    config.cloudId.toLowerCase().includes("pendiente") ||
    config.cloudId.toLowerCase().includes("todo") ||
    config.cloudId === "N/A"
  ) {
    errors.push(
      "CloudId del tracker no configurado. Sin cloudId no se puede interactuar con el tracker. Configuralo en .ai-internal/project-profile.md.",
    );
  }

  if (!config.projectKey) {
    warnings.push(
      "Project Key del tracker no configurado en el perfil. Algunos comandos pueden no funcionar correctamente.",
    );
  }

  if (!config.idioma) {
    warnings.push(
      "Idioma no detectado en el perfil. Se usará español por defecto para los artefactos.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
