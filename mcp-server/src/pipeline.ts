import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PipelineState,
  VALID_TRANSITIONS,
  NEXT_ACTIONS,
  NEXT_COMMANDS,
  STATE_DESCRIPTIONS,
  defaultPipelineData,
} from "./types.js";
import type { PipelineData, LogEntry, TicketEntry } from "./types.js";
import { loadProjectConfig } from "./config.js";

const MAX_LOG_ENTRIES = 100;

// Resolve project root from the compiled JS location:
// dist/pipeline.js → dist/ → mcp-server/ → .ai-internal/ → PROJECT_ROOT
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

const STATE_PATH = join(
  PROJECT_ROOT,
  ".ai-internal",
  "pipeline-state.json",
);

export async function loadState(): Promise<PipelineData> {
  try {
    const content = await readFile(STATE_PATH, "utf-8");
    const data = JSON.parse(content) as PipelineData;
    // Validate state is a known enum value
    if (!Object.values(PipelineState).includes(data.state)) {
      console.error(
        `Warning: Unknown pipeline state "${data.state}" in ${STATE_PATH}, resetting to IDLE.`,
      );
      data.state = PipelineState.IDLE;
    }
    return data;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // File doesn't exist yet — expected on first run
      return defaultPipelineData();
    }
    // File exists but is corrupted or unreadable — warn explicitly
    console.error(
      `ERROR: Failed to load pipeline state from ${STATE_PATH}: ${(err as Error).message}. Resetting to IDLE. Previous state may be lost.`,
    );
    return defaultPipelineData();
  }
}

export async function saveState(data: PipelineData): Promise<void> {
  // Trim log to prevent unbounded growth
  if (data.log.length > MAX_LOG_ENTRIES) {
    data.log = data.log.slice(-MAX_LOG_ENTRIES);
  }

  await mkdir(dirname(STATE_PATH), { recursive: true });

  // Atomic write: write to temp file, then rename
  const tmpPath = STATE_PATH + ".tmp";
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmpPath, STATE_PATH);
}

export function canTransition(
  from: PipelineState,
  to: PipelineState,
): { valid: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    const allowedStr = allowed?.join(", ") ?? "ninguno";
    return {
      valid: false,
      error: `Transición ilegal: ${from} → ${to}. Transiciones válidas desde ${from}: [${allowedStr}].`,
    };
  }
  return { valid: true };
}

export interface AdvanceResult {
  ok: boolean;
  from: PipelineState;
  to: PipelineState;
  error?: string;
}

export async function advance(
  to: PipelineState,
  change?: string,
): Promise<AdvanceResult> {
  const data = await loadState();
  const from = data.state;

  const check = canTransition(from, to);
  if (!check.valid) {
    return { ok: false, from, to, error: check.error };
  }

  // Gate: PLAN requires activeTicket (can't plan without selecting a ticket)
  if (to === PipelineState.PLAN && !data.activeTicket) {
    return {
      ok: false,
      from,
      to,
      error: "No se puede avanzar a PLAN sin un ticket activo. Usá sdd_set_active_ticket primero.",
    };
  }

  // Gate: IMPLEMENTACION requires activeTicket (can't implement without a ticket)
  if (to === PipelineState.IMPLEMENTACION && !data.activeTicket) {
    return {
      ok: false,
      from,
      to,
      error: "No se puede avanzar a IMPLEMENTACION sin un ticket activo. Usá sdd_set_active_ticket primero.",
    };
  }

  // Gate: IMPLEMENTACION requires a feature branch (can't implement on main/dev)
  if (to === PipelineState.IMPLEMENTACION && !data.featureBranch) {
    return {
      ok: false,
      from,
      to,
      error:
        "⛔ No se puede implementar sin una rama feature creada. " +
        "Usá sdd_register_branch para registrar la rama feature/{TICKET_ID}-slug " +
        "ANTES de avanzar a IMPLEMENTACION. NUNCA implementar en main/dev directamente.",
    };
  }

  // Gate: EVIDENCIA → COMMIT requires screenshot for frontend/fullstack projects
  if (from === PipelineState.EVIDENCIA && to === PipelineState.COMMIT) {
    const config = await loadProjectConfig();
    const tipo = config?.tipo?.toLowerCase() ?? "";
    const requiresScreenshot =
      tipo.includes("frontend") || tipo.includes("fullstack") || tipo.includes("mobile");
    if (requiresScreenshot && !data.screenshotCaptured) {
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ Proyecto " + tipo + " requiere screenshot obligatorio antes de avanzar a COMMIT. " +
          "Usá Chrome DevTools o Playwright para capturar un screenshot del cambio funcionando, " +
          "luego llamá sdd_register_screenshot. Sin evidencia visual no se puede avanzar.",
      };
    }
  }

  // Gate: COMPLETADO → TICKETS requires user confirmation via sdd_confirm_next
  if (
    from === PipelineState.COMPLETADO &&
    to === PipelineState.TICKETS &&
    data.awaitingUserConfirmation
  ) {
    return {
      ok: false,
      from,
      to,
      error:
        "⛔ No se puede continuar al siguiente ticket sin confirmación del usuario. " +
        "Llamá sdd_confirm_next DESPUÉS de que el usuario haya confirmado explícitamente " +
        "que quiere continuar. Usá AskUserQuestion para preguntarle.",
    };
  }

  data.state = to;
  if (change) data.change = change;

  // Set confirmation gate when entering COMPLETADO
  if (to === PipelineState.COMPLETADO) {
    data.awaitingUserConfirmation = true;
  }

  // Reset when going back to IDLE (full reset)
  if (to === PipelineState.IDLE) {
    data.activeTicket = null;
    data.tickets = [];
    data.change = null;
    data.awaitingUserConfirmation = false;
    data.featureBranch = null;
    data.screenshotCaptured = false;
  }

  // Reset per-ticket state when cycling back to TICKETS from COMPLETADO
  // (previous ticket is done, need to select a new one)
  if (to === PipelineState.TICKETS && from === PipelineState.COMPLETADO) {
    data.activeTicket = null;
    data.featureBranch = null;
    data.screenshotCaptured = false;
  }

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "ADVANCE",
    from,
    to,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, from, to };
}

export interface RegisterTicketsResult {
  ok: boolean;
  count: number;
  totalTickets: number;
  error?: string;
}

export async function registerTickets(
  tickets: TicketEntry[],
): Promise<RegisterTicketsResult> {
  const data = await loadState();

  if (
    data.state !== PipelineState.TICKETS &&
    data.state !== PipelineState.ARTEFACTOS
  ) {
    return {
      ok: false,
      count: 0,
      totalTickets: data.tickets.length,
      error: `Solo se pueden registrar tickets en estado ARTEFACTOS o TICKETS. Estado actual: ${data.state}.`,
    };
  }

  // Append + deduplicate by ID (new tickets override existing ones with same ID)
  const existingMap = new Map(data.tickets.map((t) => [t.id, t]));
  for (const ticket of tickets) {
    existingMap.set(ticket.id, ticket);
  }
  data.tickets = Array.from(existingMap.values());

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_TICKETS",
    count: tickets.length,
    detail: `Added: ${tickets.map((t) => t.id).join(", ")}. Total: ${data.tickets.length}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, count: tickets.length, totalTickets: data.tickets.length };
}

export interface SetActiveTicketResult {
  ok: boolean;
  ticket?: TicketEntry;
  error?: string;
}

const VALID_STATES_FOR_SET_ACTIVE = [
  PipelineState.TICKETS,
  PipelineState.PLAN,
];

export async function setActiveTicket(
  ticketId: string,
): Promise<SetActiveTicketResult> {
  const data = await loadState();

  // Validate pipeline state
  if (!VALID_STATES_FOR_SET_ACTIVE.includes(data.state)) {
    return {
      ok: false,
      error: `Solo se puede activar un ticket en estado TICKETS o PLAN. Estado actual: ${data.state}.`,
    };
  }

  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    const ids = data.tickets.map((t) => t.id).join(", ");
    return {
      ok: false,
      error: `Ticket "${ticketId}" no encontrado en la lista registrada. Tickets disponibles: [${ids}].`,
    };
  }

  data.activeTicket = ticketId;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "SET_ACTIVE_TICKET",
    detail: ticketId,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, ticket };
}

// ─── Branch registration ────────────────────────────────────────────────────

export interface RegisterBranchResult {
  ok: boolean;
  branch?: string;
  error?: string;
}

const FEATURE_BRANCH_PATTERN = /^(feature|hotfix|bugfix)\/.+/;
const FORBIDDEN_BRANCHES = ["main", "master", "dev", "develop", "staging", "production"];

export async function registerBranch(
  branchName: string,
): Promise<RegisterBranchResult> {
  const data = await loadState();

  if (
    data.state !== PipelineState.PLAN &&
    data.state !== PipelineState.TICKETS
  ) {
    return {
      ok: false,
      error: `Solo se puede registrar una rama en estado PLAN o TICKETS. Estado actual: ${data.state}.`,
    };
  }

  // Reject direct work on protected branches
  const normalized = branchName.toLowerCase().trim();
  if (FORBIDDEN_BRANCHES.includes(normalized)) {
    return {
      ok: false,
      error:
        `⛔ Rama "${branchName}" es una rama protegida. ` +
        "Creá una rama feature/{TICKET_ID}-slug para trabajar. " +
        "NUNCA se implementa en main, dev, master o develop directamente.",
    };
  }

  // Validate branch name follows convention
  if (!FEATURE_BRANCH_PATTERN.test(normalized)) {
    return {
      ok: false,
      error:
        `⛔ Rama "${branchName}" no sigue la convención. ` +
        "Las ramas deben seguir el patrón: feature/{TICKET_ID}-slug, hotfix/{TICKET_ID}-slug, o bugfix/{TICKET_ID}-slug.",
    };
  }

  data.featureBranch = branchName;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_BRANCH",
    detail: branchName,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, branch: branchName };
}

// ─── Screenshot registration ─────────────────────────────────────────────────

export interface RegisterScreenshotResult {
  ok: boolean;
  error?: string;
}

export async function registerScreenshot(
  filePath: string,
): Promise<RegisterScreenshotResult> {
  const data = await loadState();

  if (
    data.state !== PipelineState.IMPLEMENTACION &&
    data.state !== PipelineState.EVIDENCIA
  ) {
    return {
      ok: false,
      error: `Solo se puede registrar screenshot en estado IMPLEMENTACION o EVIDENCIA. Estado actual: ${data.state}.`,
    };
  }

  data.screenshotCaptured = true;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_SCREENSHOT",
    detail: `Screenshot captured: ${filePath} for ticket ${data.activeTicket}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true };
}

export interface ConfirmNextResult {
  ok: boolean;
  remainingTickets: string[];
  error?: string;
}

export async function confirmNext(): Promise<ConfirmNextResult> {
  const data = await loadState();

  if (data.state !== PipelineState.COMPLETADO) {
    return {
      ok: false,
      remainingTickets: [],
      error: `Solo se puede confirmar continuación en estado COMPLETADO. Estado actual: ${data.state}.`,
    };
  }

  if (!data.awaitingUserConfirmation) {
    return {
      ok: false,
      remainingTickets: [],
      error: "No hay confirmación pendiente.",
    };
  }

  data.awaitingUserConfirmation = false;

  const completedTicket = data.activeTicket;
  const remaining = data.tickets
    .filter((t) => t.id !== completedTicket)
    .map((t) => t.id);

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "USER_CONFIRMED_NEXT",
    detail: `User confirmed continue after completing ${completedTicket}. Remaining: ${remaining.length}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, remainingTickets: remaining };
}

export interface GetStateResult {
  state: PipelineState;
  stateDescription: string;
  change: string | null;
  activeTicket: string | null;
  tickets: TicketEntry[];
  nextAction: string;
  nextCommand: string;
  awaitingUserConfirmation: boolean;
  featureBranch: string | null;
  screenshotCaptured: boolean;
}

export async function getState(): Promise<GetStateResult> {
  const data = await loadState();

  // Resolve {tracker} and {tipo} placeholders in nextCommand using project config
  let nextCommand = NEXT_COMMANDS[data.state];
  const config = await loadProjectConfig();
  if (config) {
    nextCommand = nextCommand
      .replace(/\{tracker\}/g, config.tracker || "jira")
      .replace(/\{tipo\}/g, config.tipo || "fullstack");
  }

  return {
    state: data.state,
    stateDescription: STATE_DESCRIPTIONS[data.state],
    change: data.change,
    activeTicket: data.activeTicket,
    tickets: data.tickets,
    nextAction: NEXT_ACTIONS[data.state],
    nextCommand,
    awaitingUserConfirmation: data.awaitingUserConfirmation ?? false,
    featureBranch: data.featureBranch ?? null,
    screenshotCaptured: data.screenshotCaptured ?? false,
  };
}
