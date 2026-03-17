import { loadProjectConfig } from "./config.js";
import {
  buildTransitionInstructions as jiraTransition,
  buildCommentInstructions as jiraComment,
} from "./jira.js";
import {
  buildTransitionInstructions as notionTransition,
  buildCommentInstructions as notionComment,
} from "./notion.js";

/**
 * Unified delegation response for any tracker.
 * Claude receives steps and executes them via the appropriate MCP.
 */
export interface TrackerDelegation {
  ok: boolean;
  action: "DELEGATE_TO_ATLASSIAN_MCP" | "DELEGATE_TO_NOTION_MCP";
  error?: string;
  steps: TrackerDelegationStep[];
  // Jira-specific context
  cloudId?: string;
  ticketId?: string;
  // Notion-specific context
  notionDatabaseId?: string;
  pageId?: string;
}

export interface TrackerDelegationStep {
  step: number;
  description: string;
  tool: string;
  params: Record<string, string>;
  matchLogic?: string;
}

/**
 * Builds transition instructions for the configured tracker.
 * Reads config.tracker and delegates to jira.ts or notion.ts.
 */
export async function buildTransitionInstructions(
  ticketId: string,
): Promise<TrackerDelegation> {
  const config = await loadProjectConfig();

  if (!config || !config.tracker) {
    return {
      ok: false,
      action: "DELEGATE_TO_ATLASSIAN_MCP",
      error:
        "Tracker no configurado en project-profile.md. Ejecutá /bootstrap para configurar.",
      steps: [],
    };
  }

  if (config.tracker === "notion") {
    return notionTransition(ticketId);
  }

  // Default: jira
  return jiraTransition(ticketId);
}

/**
 * Builds comment instructions for the configured tracker.
 * Reads config.tracker and delegates to jira.ts or notion.ts.
 */
export async function buildCommentInstructions(
  ticketId: string,
  commentBody: string,
): Promise<TrackerDelegation> {
  const config = await loadProjectConfig();

  if (!config || !config.tracker) {
    return {
      ok: false,
      action: "DELEGATE_TO_ATLASSIAN_MCP",
      error:
        "Tracker no configurado en project-profile.md. Ejecutá /bootstrap para configurar.",
      steps: [],
    };
  }

  if (config.tracker === "notion") {
    return notionComment(ticketId, commentBody);
  }

  // Default: jira
  return jiraComment(ticketId, commentBody);
}
