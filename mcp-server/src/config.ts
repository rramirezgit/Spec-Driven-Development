import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectConfig, SubprojectConfig, DocusaurusConfig } from "./types.js";

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

export function parseProfile(content: string): ProjectConfig {
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

  // Extract Notion QA status from Notion Statuses JSON (if present)
  const notionStatusesRaw = get("Notion Statuses", "notion_statuses");
  let notionQaStatus = "";
  if (notionStatusesRaw) {
    try {
      const statuses = JSON.parse(notionStatusesRaw);
      notionQaStatus = statuses.qa_review || "";
    } catch {
      // Not valid JSON — ignore
    }
  }

  const tipo = get("Tipo", "tipo", "Type", "type", "Project Type");

  // Multi-target mode (V4.10+): one set of commands per subproject
  const multiTargetRaw = get("Multi Target Mode", "multi_target_mode", "MultiTargetMode");
  const multiTargetMode = multiTargetRaw.toLowerCase() === "true";

  const subprojectSlugsRaw = get("Subproject Slugs", "subproject_slugs");
  const subprojectSlugs = subprojectSlugsRaw
    ? subprojectSlugsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  // V4.14: commit style (standard | conventional). Default = standard for backward-compat.
  const commitStyleRaw = get("Commit Style", "commit_style", "CommitStyle");
  const commitStyleNormalized = commitStyleRaw.toLowerCase().trim();
  const commitStyle: "standard" | "conventional" =
    commitStyleNormalized === "conventional" ? "conventional" : "standard";

  // V4.18: Definition of Ready enforcement mode. Default = "off" for backward-compat
  // (proyectos pre-V4.18 sin la key no reciben el gate). Phase 0c default = "warn"
  // para bootstraps nuevos.
  const dorEnforcementRaw = get(
    "DoR Enforcement",
    "dor_enforcement",
    "DorEnforcement",
  );
  const dorNormalized = dorEnforcementRaw.toLowerCase().trim();
  const dorEnforcement: "off" | "warn" | "strict" =
    dorNormalized === "strict"
      ? "strict"
      : dorNormalized === "warn"
        ? "warn"
        : "off";

  // V4.16: Docusaurus integration. Only populated if phase 0b detected docusaurus.config.*
  // and the user confirmed in phase 0c. Default = absent (no docs gate, full backward-compat).
  let docusaurus: DocusaurusConfig | undefined;
  const docusaurusEnabledRaw = get(
    "Docusaurus Enabled",
    "docusaurus_enabled",
    "DocusaurusEnabled",
  );
  if (docusaurusEnabledRaw && docusaurusEnabledRaw.toLowerCase().trim() === "true") {
    const root = get("Docusaurus Root", "docusaurus_root", "DocusaurusRoot") || ".";
    const docsPath = get("Docusaurus Docs Path", "docusaurus_docs_path", "DocusaurusDocsPath") || "docs";
    docusaurus = {
      root,
      docsPath,
      enabled: true,
      mode: "critical",
    };
  }

  // Parse subprojects when relevant: multi-target OR classic monorepo-fullstack
  let subprojects: SubprojectConfig[] | undefined;
  if (multiTargetMode || tipo === "monorepo-fullstack") {
    subprojects = parseSubprojects(content);
  }

  const tracker = get("Tracker", "tracker");

  return {
    nombre: get("Nombre", "nombre", "Project Name", "project_name"),
    tipo,
    tracker,
    // Jira-specific
    cloudId: get("CloudId", "cloudId", "cloud_id", "Tracker CloudId") || undefined,
    projectKey: get("Tracker Project Key", "project_key", "Project Key") || undefined,
    jiraQaStatus: jiraQaStatus || undefined,
    // Notion-specific
    notionDatabaseId: get("Notion Database ID", "notion_database_id") || undefined,
    notionStatusProperty: get("Notion Status Property", "notion_status_property") || undefined,
    notionQaStatus: notionQaStatus || undefined,
    // Common
    idioma: get("Idioma", "idioma", "Language", "language"),
    subprojects,
    multiTargetMode: multiTargetMode || undefined,
    subprojectSlugs,
    commitStyle,
    docusaurus,
    dorEnforcement,
  };
}

function parseSubprojects(content: string): SubprojectConfig[] {
  const subprojects: SubprojectConfig[] = [];

  // Match "### frontend" or "### backend" sections under "## Subprojects"
  const subprojectsSection = content.match(/## Subprojects([\s\S]*?)(?=\n## [^#]|$)/i);
  if (!subprojectsSection) return subprojects;

  const sectionContent = subprojectsSection[1];
  const subSections = sectionContent.split(/### /).filter(Boolean);

  for (const sub of subSections) {
    const lines = sub.trim().split("\n");
    const name = lines[0]?.trim().toLowerCase();
    if (!name) continue;

    const getField = (key: string): string => {
      for (const line of lines) {
        const match = line.match(new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, "i"));
        if (match?.[1]) return match[1].trim();
      }
      return "";
    };

    subprojects.push({
      path: getField("Path") || name,
      tipo: name === "frontend" || name === "front" ? "frontend" : name === "backend" || name === "back" ? "backend" : name,
      framework: getField("Framework"),
      uiLibrary: getField("UI Library") || undefined,
      orm: getField("ORM") || undefined,
      testing: getField("Testing") || undefined,
    });
  }

  return subprojects;
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

  // Tracker-specific validation
  if (config.tracker === "jira") {
    if (
      !config.cloudId ||
      config.cloudId.toLowerCase().includes("pendiente") ||
      config.cloudId.toLowerCase().includes("todo") ||
      config.cloudId === "N/A"
    ) {
      errors.push(
        "CloudId del tracker no configurado. Sin cloudId no se puede interactuar con Jira. Configuralo en .ai-internal/project-profile.md.",
      );
    }

    if (!config.projectKey) {
      warnings.push(
        "Project Key del tracker no configurado en el perfil. Algunos comandos pueden no funcionar correctamente.",
      );
    }
  } else if (config.tracker === "notion") {
    if (!config.notionDatabaseId) {
      errors.push(
        "Notion Database ID no configurado. Sin database ID no se puede interactuar con Notion. Configuralo en .ai-internal/project-profile.md.",
      );
    }
  } else if (config.tracker) {
    // Unknown tracker — validate as jira (backwards compat)
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
