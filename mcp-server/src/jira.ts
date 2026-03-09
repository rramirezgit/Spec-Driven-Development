import { loadProjectConfig } from "./config.js";

/**
 * QA transition names to search for (case-insensitive).
 * The Atlassian MCP's getTransitionsForJiraIssue returns available transitions.
 * Claude must match one of these names from the result.
 */
const QA_TRANSITION_NAMES = [
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

export interface JiraDelegation {
  ok: boolean;
  action: "DELEGATE_TO_ATLASSIAN_MCP";
  error?: string;
  cloudId?: string;
  ticketId?: string;
  steps: JiraDelegationStep[];
}

export interface JiraDelegationStep {
  step: number;
  description: string;
  tool: string;
  params: Record<string, string>;
  matchLogic?: string;
}

/**
 * Returns structured instructions for Claude to execute the QA transition
 * using the Atlassian MCP tools (which are already authenticated).
 *
 * This replaces the old direct REST API approach that required
 * JIRA_API_TOKEN and JIRA_EMAIL environment variables.
 */
export async function buildTransitionInstructions(
  ticketId: string,
): Promise<JiraDelegation> {
  const config = await loadProjectConfig();

  if (!config || !config.cloudId) {
    return {
      ok: false,
      action: "DELEGATE_TO_ATLASSIAN_MCP",
      error:
        "CloudId no configurado en project-profile.md. Sin cloudId no se puede interactuar con Jira.",
      steps: [],
    };
  }

  return {
    ok: true,
    action: "DELEGATE_TO_ATLASSIAN_MCP",
    cloudId: config.cloudId,
    ticketId,
    steps: [
      {
        step: 1,
        description: `Obtener transiciones disponibles para ${ticketId}`,
        tool: "getTransitionsForJiraIssue",
        params: {
          cloudId: config.cloudId,
          issueIdOrKey: ticketId,
        },
        matchLogic: `De las transiciones retornadas, buscar una cuyo nombre (case-insensitive) sea uno de: ${QA_TRANSITION_NAMES.join(", ")}. Si ninguna coincide, informar al usuario que la transición a QA no está disponible y listar las transiciones existentes.`,
      },
      {
        step: 2,
        description: `Ejecutar la transición a QA para ${ticketId}`,
        tool: "transitionJiraIssue",
        params: {
          cloudId: config.cloudId,
          issueIdOrKey: ticketId,
          transitionId: "<ID de la transición encontrada en step 1>",
        },
      },
    ],
  };
}

/**
 * Returns structured instructions for Claude to add a comment to a ticket
 * using the Atlassian MCP tools.
 */
export async function buildCommentInstructions(
  ticketId: string,
  commentBody: string,
): Promise<JiraDelegation> {
  const config = await loadProjectConfig();

  if (!config || !config.cloudId) {
    return {
      ok: false,
      action: "DELEGATE_TO_ATLASSIAN_MCP",
      error:
        "CloudId no configurado en project-profile.md. Sin cloudId no se puede interactuar con Jira.",
      steps: [],
    };
  }

  return {
    ok: true,
    action: "DELEGATE_TO_ATLASSIAN_MCP",
    cloudId: config.cloudId,
    ticketId,
    steps: [
      {
        step: 1,
        description: `Agregar comentario a ${ticketId}`,
        tool: "addCommentToJiraIssue",
        params: {
          cloudId: config.cloudId,
          issueIdOrKey: ticketId,
          body: commentBody,
        },
      },
    ],
  };
}
