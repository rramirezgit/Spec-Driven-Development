import { loadProjectConfig } from "./config.js";
import type { TrackerDelegation, TrackerDelegationStep } from "./tracker.js";

/**
 * Default QA status names to search for in Notion (case-insensitive).
 * If the project profile has a custom QA status name, it gets prepended.
 */
const DEFAULT_QA_STATUS_NAMES = [
  "qa review",
  "ready for qa",
  "qa",
  "in review",
  "code review",
  "review",
  "ready for review",
  "en revisión",
  "revisión qa",
  "revisión de código",
];

/**
 * Returns structured instructions for Claude to transition a Notion page
 * to QA Review status using the Notion MCP tools.
 *
 * The approach:
 * 1. Find the page in the database by its unique_id or title matching ticketId
 * 2. Update the status property to the QA Review value
 */
export async function buildTransitionInstructions(
  ticketId: string,
): Promise<TrackerDelegation> {
  const config = await loadProjectConfig();

  if (!config || !config.notionDatabaseId) {
    return {
      ok: false,
      action: "DELEGATE_TO_NOTION_MCP",
      error:
        "Notion Database ID no configurado en project-profile.md. Sin database ID no se puede interactuar con Notion.",
      steps: [],
    };
  }

  const statusProperty = config.notionStatusProperty || "Status";

  // Build status name list: custom name from profile gets priority
  const statusNames = config.notionQaStatus
    ? [config.notionQaStatus.toLowerCase(), ...DEFAULT_QA_STATUS_NAMES]
    : [...DEFAULT_QA_STATUS_NAMES];

  const uniqueNames = [...new Set(statusNames)];

  const steps: TrackerDelegationStep[] = [
    {
      step: 1,
      description: `Buscar la página del ticket ${ticketId} en la database de Notion`,
      tool: "API-query-data-source",
      params: {
        data_source_id: config.notionDatabaseId!,
        filter: JSON.stringify({
          property: "title",
          title: { contains: ticketId },
        }),
      },
      matchLogic: `Buscar una página cuyo título o unique_id contenga "${ticketId}". Si el filtro por title no devuelve resultados, intentar con API-post-search usando query="${ticketId}" y filter={value:"page",property:"object"}. Si no se encuentra, informar al usuario.`,
    },
    {
      step: 2,
      description: `Cambiar la propiedad "${statusProperty}" a QA Review para ${ticketId}`,
      tool: "API-patch-page",
      params: {
        page_id: "<ID de la página encontrada en step 1>",
        properties: JSON.stringify({
          [statusProperty]: {
            status: { name: config.notionQaStatus || "QA Review" },
          },
        }),
      },
      matchLogic: `Actualizar la propiedad "${statusProperty}" con uno de estos valores (en orden de prioridad): ${uniqueNames.join(", ")}. Usar el valor exacto que exista en la configuración de la database. Si la propiedad es de tipo "select" en vez de "status", usar el formato select en vez de status.`,
    },
  ];

  return {
    ok: true,
    action: "DELEGATE_TO_NOTION_MCP",
    notionDatabaseId: config.notionDatabaseId,
    ticketId,
    steps,
  };
}

/**
 * Returns structured instructions for Claude to add a comment block
 * to a Notion page using the Notion MCP tools.
 *
 * In Notion, comments are native page comments via API-create-a-comment.
 */
export async function buildCommentInstructions(
  ticketId: string,
  commentBody: string,
): Promise<TrackerDelegation> {
  const config = await loadProjectConfig();

  if (!config || !config.notionDatabaseId) {
    return {
      ok: false,
      action: "DELEGATE_TO_NOTION_MCP",
      error:
        "Notion Database ID no configurado en project-profile.md. Sin database ID no se puede interactuar con Notion.",
      steps: [],
    };
  }

  const steps: TrackerDelegationStep[] = [
    {
      step: 1,
      description: `Buscar la página del ticket ${ticketId} en la database de Notion`,
      tool: "API-query-data-source",
      params: {
        data_source_id: config.notionDatabaseId!,
        filter: JSON.stringify({
          property: "title",
          title: { contains: ticketId },
        }),
      },
      matchLogic: `Buscar una página cuyo título o unique_id contenga "${ticketId}". Si no se encuentra, usar API-post-search como fallback.`,
    },
    {
      step: 2,
      description: `Agregar comentario a la página de ${ticketId}`,
      tool: "API-create-a-comment",
      params: {
        parent: JSON.stringify({ page_id: "<ID de la página encontrada en step 1>" }),
        rich_text: JSON.stringify([
          {
            type: "text",
            text: { content: commentBody },
          },
        ]),
      },
    },
  ];

  return {
    ok: true,
    action: "DELEGATE_TO_NOTION_MCP",
    notionDatabaseId: config.notionDatabaseId,
    ticketId,
    steps,
  };
}
